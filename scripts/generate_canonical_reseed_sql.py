#!/usr/bin/env python3
from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

import generate_canonical_import_report as canonical


ROOT = Path(__file__).resolve().parent.parent
SQL_ROOT = ROOT / "sql"
DEFAULT_HISTORY_OUTPUT = SQL_ROOT / "02_seed_history.sql"
DEFAULT_CURRENT_OUTPUT = SQL_ROOT / "03_seed_current.sql"
IGNORED_DISPLAY_NAMES = frozenset({"Imported", "Imported Player", "Unknown"})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate canonical SQL reseed artifacts from the workbook rebuild config."
    )
    parser.add_argument(
        "--config-root",
        type=Path,
        default=canonical.DEFAULT_CONFIG_ROOT,
        help="Folder containing season_inventory.csv, identity_map.csv, and buddy_overrides.csv.",
    )
    parser.add_argument(
        "--history-output",
        type=Path,
        default=DEFAULT_HISTORY_OUTPUT,
        help="Output SQL path for historical seasons.",
    )
    parser.add_argument(
        "--current-output",
        type=Path,
        default=DEFAULT_CURRENT_OUTPUT,
        help="Output SQL path for the current season.",
    )
    parser.add_argument(
        "--include-not-ready",
        action="store_true",
        help="Include inventory rows marked ready_for_import != yes.",
    )
    return parser.parse_args()


def merge_status(current: str | None, next_status: str) -> str:
    if current is None:
        return next_status
    if canonical.seed.STATUS_PRIORITY[next_status] > canonical.seed.STATUS_PRIORITY[current]:
        return next_status
    return current


def normalized_positions(payload: dict[str, object]) -> list[str]:
    positions = [
        canonical.seed.normalize_space(str(value))
        for value in payload.get("positions", [])
        if canonical.seed.normalize_space(str(value))
    ]
    return positions or ["MID"]


def distinct_nickname(payload: dict[str, object]) -> str | None:
    nickname = canonical.player_nickname(payload)
    return nickname or None


def payload_sort_key(payload: dict[str, object]) -> tuple[str, str, str]:
    return (
        canonical.seed.normalize_space(str(payload.get("last_name", ""))).lower(),
        canonical.seed.normalize_space(str(payload.get("first_name", ""))).lower(),
        canonical.seed.normalize_space(str(payload.get("display_name", ""))).lower(),
    )


def season_alias(season_name: str) -> str:
    slug = "".join(char.lower() if char.isalnum() else "_" for char in season_name)
    slug = "_".join(part for part in slug.split("_") if part)
    return f"season_{slug}_ready"


def sql_bool(value: bool) -> str:
    return "true" if value else "false"


def assignment_source_kind(raw_label: str) -> str:
    normalized_label = canonical.seed.normalize_import_label(raw_label)
    is_sub = canonical.seed.is_sub_import_label(normalized_label)
    is_slash = len(canonical.seed.split_player_labels(normalized_label)) > 1
    if not is_slash and not is_sub:
        return "single"
    if not is_slash and is_sub:
        return "sub_single"
    if is_slash and not is_sub:
        return "slash"
    return "sub_slash"


def assignment_source_priority(raw_label: str) -> int:
    return {
        "single": 4,
        "sub_single": 3,
        "slash": 2,
        "sub_slash": 1,
    }[assignment_source_kind(raw_label)]


def build_canonical_season_dataset(
    row: dict[str, str],
    rule_players: dict[str, canonical.CanonicalPlayerRule],
    alias_claims: dict[str, set[str]],
    override_lookup: dict[tuple[str, int, str], canonical.BuddyOverride],
) -> dict[str, object]:
    season_name = canonical.seed.normalize_space(row.get("season_name", ""))
    season_folder = (ROOT / canonical.seed.normalize_space(row.get("season_folder", ""))).resolve()
    workbook_name = canonical.seed.normalize_space(row.get("workbook_file", "")) or "workbook.xlsx"
    workbook_path = (season_folder / workbook_name).resolve()
    ready_for_import = canonical.normalize_bool(row.get("ready_for_import"))

    dataset: dict[str, object] = {
        "season_name": season_name,
        "season_folder": str(season_folder),
        "workbook_path": str(workbook_path),
        "ready_for_import": ready_for_import,
        "workbook_exists": workbook_path.exists(),
        "weekly_sheet": None,
        "match_dates_sheet": None,
        "missing_sheets": [],
        "issues": [],
        "unresolved_labels": [],
        "matchdays": [],
        "matches": [],
        "canonical_players": [],
        "season_players": [],
        "assignments": [],
        "stats": [],
        "summary": {
            "raw_assignment_rows": 0,
            "generated_assignment_rows": 0,
            "normalized_assignment_conflicts": 0,
            "raw_stat_rows": 0,
            "generated_stat_rows": 0,
            "canonical_player_count": 0,
            "matchday_count": 0,
            "match_count": 0,
            "stat_source": None,
            "core_spots": 0,
            "rotation_spots": 0,
        },
    }

    if not workbook_path.exists():
        dataset["issues"].append(
            {
                "type": "missing_workbook",
                "reason": "Workbook file not found.",
                "path": str(workbook_path),
            }
        )
        return dataset

    workbook = canonical.seed.WorkbookReader(workbook_path)
    try:
        weekly_sheet = canonical.resolve_weekly_sheet_name(workbook)
        match_dates_sheet = canonical.resolve_match_dates_sheet_name(workbook)
        missing_sheets = [
            sheet_name for sheet_name in canonical.REQUIRED_SHEETS if sheet_name not in workbook.sheet_members
        ]
        if match_dates_sheet is None:
            missing_sheets.append("MATCH_DATES or MATCH DATES")
        if weekly_sheet is None:
            missing_sheets.append("WEEKLY_TEAMS or WEEKLY_ROSTER")

        dataset["weekly_sheet"] = weekly_sheet
        dataset["match_dates_sheet"] = match_dates_sheet
        dataset["missing_sheets"] = missing_sheets

        if missing_sheets:
            dataset["issues"].append(
                {
                    "type": "missing_sheets",
                    "reason": "Workbook is missing required tabs for canonical parsing.",
                    "sheet_names": missing_sheets,
                }
            )
            return dataset

        match_dates = canonical.seed.parse_match_dates(workbook.read_rows(match_dates_sheet))
        weekly_rows = workbook.read_rows(weekly_sheet)
        stat_rows = workbook.read_rows("PLAYER_STAT") if "PLAYER_STAT" in workbook.sheet_members else []
        match_rows = canonical.seed.parse_match_rows(workbook.read_rows("MATCH_INPUT"))
    except Exception as error:
        dataset["issues"].append(
            {
                "type": "workbook_parse_error",
                "reason": str(error),
            }
        )
        return dataset
    finally:
        workbook.close()

    resolver = canonical.SeasonResolver(season_name, workbook_path, rule_players, alias_claims, override_lookup)
    total_matchdays = max((matchday_number for matchday_number, _ in match_dates), default=0)
    weekly_records = canonical.collect_weekly_records(weekly_rows, total_matchdays)
    if stat_rows:
        stat_records = canonical.collect_stat_records(stat_rows)
        dataset["summary"]["stat_source"] = "PLAYER_STAT"
    else:
        stat_records = canonical.collect_weekly_stat_records(weekly_rows, total_matchdays)
        dataset["summary"]["stat_source"] = "WEEKLY_TEAMS fallback"
        dataset["issues"].append(
            {
                "type": "missing_player_stat",
                "reason": "PLAYER_STAT tab missing, using WEEKLY_TEAMS fallback stats.",
            }
        )

    dataset["summary"]["raw_assignment_rows"] = sum(1 for record in weekly_records if record["team_code"])
    dataset["summary"]["raw_stat_rows"] = len(stat_records)
    dataset["summary"]["matchday_count"] = len(match_dates)
    dataset["summary"]["match_count"] = len(match_rows)

    season_players_by_key: dict[str, dict[str, object]] = {}
    season_tier_statuses: dict[str, str] = {}
    weekly_resolution_map: dict[tuple[str, int], list[dict[str, object]]] = {}
    assignment_map: dict[tuple[int, str], dict[str, object]] = {}
    attendance_map: dict[tuple[str, int], bool] = {}
    stat_buckets: dict[tuple[str, int], dict[str, object]] = {}

    for record in weekly_records:
        payloads, issue = resolver.resolve_label(
            str(record["raw_label"]),
            int(record["matchday_number"]),
            "weekly_assignment",
        )
        if issue is not None:
            dataset["unresolved_labels"].append(issue)
            continue
        if payloads is None:
            continue

        matchday_number = int(record["matchday_number"])
        weekly_resolution_map[(canonical.seed.normalize_label(str(record["raw_label"])), matchday_number)] = payloads
        raw_status = canonical.seed.status_from_import_label(str(record["raw_label"]))

        for payload in payloads:
            player_key = str(payload["player_key"])
            season_players_by_key[player_key] = payload
            season_tier_statuses[player_key] = merge_status(
                season_tier_statuses.get(player_key),
                raw_status,
            )
            attendance_map[(player_key, matchday_number)] = bool(record["attended"]) or attendance_map.get(
                (player_key, matchday_number),
                False,
            )

            if record["team_code"]:
                assignment_key = (matchday_number, player_key)
                candidate_assignment = {
                    "matchday_number": matchday_number,
                    "player_key": player_key,
                    "first_name": str(payload["first_name"]),
                    "last_name": str(payload["last_name"]),
                    "team_code": str(record["team_code"]),
                    "raw_label": str(record["raw_label"]),
                    "source_kind": assignment_source_kind(str(record["raw_label"])),
                    "source_priority": assignment_source_priority(str(record["raw_label"])),
                }
                existing_assignment = assignment_map.get(assignment_key)
                if existing_assignment is None:
                    assignment_map[assignment_key] = candidate_assignment
                elif existing_assignment["team_code"] == str(record["team_code"]):
                    if int(candidate_assignment["source_priority"]) > int(existing_assignment["source_priority"]):
                        assignment_map[assignment_key] = candidate_assignment
                else:
                    chosen_assignment = existing_assignment
                    rejected_assignment = candidate_assignment
                    if int(candidate_assignment["source_priority"]) > int(existing_assignment["source_priority"]):
                        assignment_map[assignment_key] = candidate_assignment
                        chosen_assignment = candidate_assignment
                        rejected_assignment = existing_assignment
                    dataset["issues"].append(
                        {
                            "type": "normalized_assignment_conflict",
                            "reason": (
                                "Resolved player received multiple team codes on the same matchday; "
                                "kept the highest-confidence assignment source."
                            ),
                            "matchday_number": matchday_number,
                            "player_key": player_key,
                            "raw_label": str(rejected_assignment["raw_label"]),
                            "source_kind": str(rejected_assignment["source_kind"]),
                            "kept_team_code": str(chosen_assignment["team_code"]),
                            "kept_raw_label": str(chosen_assignment["raw_label"]),
                            "kept_source_kind": str(chosen_assignment["source_kind"]),
                            "dropped_team_code": str(rejected_assignment["team_code"]),
                        }
                    )
                    dataset["summary"]["normalized_assignment_conflicts"] = (
                        int(dataset["summary"]["normalized_assignment_conflicts"]) + 1
                    )

        if record["team_code"]:
            dataset["summary"]["generated_assignment_rows"] += len(payloads)

    for record in stat_records:
        matchday_number = int(record["matchday_number"])
        lookup_key = (
            canonical.seed.normalize_label(str(record["raw_label"])),
            matchday_number,
        )
        payloads = weekly_resolution_map.get(lookup_key)
        issue = None
        if payloads is None:
            payloads, issue = resolver.resolve_label(
                str(record["raw_label"]),
                matchday_number,
                "player_stat",
            )
        if issue is not None:
            dataset["unresolved_labels"].append(issue)
            continue
        if payloads is None:
            continue

        raw_status = canonical.seed.status_from_import_label(str(record["raw_label"]))
        dataset["summary"]["generated_stat_rows"] += len(payloads)

        for payload in payloads:
            player_key = str(payload["player_key"])
            season_players_by_key[player_key] = payload
            season_tier_statuses[player_key] = merge_status(
                season_tier_statuses.get(player_key),
                raw_status,
            )
            attendance_map[(player_key, matchday_number)] = True
            stat_key = (player_key, matchday_number)
            bucket = stat_buckets.setdefault(
                stat_key,
                {
                    "matchday_number": matchday_number,
                    "player_key": player_key,
                    "first_name": str(payload["first_name"]),
                    "last_name": str(payload["last_name"]),
                    "goals": 0,
                    "goal_keeps": 0,
                    "clean_sheet": False,
                },
            )
            bucket["goals"] = int(bucket["goals"]) + int(record["goals"])
            bucket["goal_keeps"] = int(bucket["goal_keeps"]) + int(record["goal_keeps"])
            bucket["clean_sheet"] = bool(bucket["clean_sheet"]) or bool(record["clean_sheet"])

    canonical_players = sorted(season_players_by_key.values(), key=payload_sort_key)
    dataset["canonical_players"] = canonical_players
    dataset["summary"]["canonical_player_count"] = len(canonical_players)

    season_player_rows = []
    for player_key, payload in season_players_by_key.items():
        tier_status = season_tier_statuses.get(player_key) or str(payload.get("status") or "rotation")
        season_player_rows.append(
            {
                **payload,
                "tier_status": tier_status,
            }
        )

    dataset["season_players"] = sorted(season_player_rows, key=payload_sort_key)
    dataset["summary"]["core_spots"] = sum(
        1 for player in dataset["season_players"] if player["tier_status"] == "core"
    )
    dataset["summary"]["rotation_spots"] = sum(
        1 for player in dataset["season_players"] if player["tier_status"] == "rotation"
    )
    if (
        dataset["season_players"]
        and dataset["summary"]["core_spots"] == 0
        and dataset["summary"]["rotation_spots"] == 0
    ):
        dataset["summary"]["rotation_spots"] = 1

    dataset["assignments"] = sorted(
        assignment_map.values(),
        key=lambda row_value: (
            int(row_value["matchday_number"]),
            str(row_value["last_name"]).lower(),
            str(row_value["first_name"]).lower(),
        ),
    )

    stat_rows_out = []
    for player_key, matchday_number in sorted(
        set(attendance_map) | set(stat_buckets),
        key=lambda item: (
            int(item[1]),
            str(season_players_by_key[item[0]]["last_name"]).lower(),
            str(season_players_by_key[item[0]]["first_name"]).lower(),
        ),
    ):
        payload = season_players_by_key[player_key]
        bucket = stat_buckets.get((player_key, matchday_number), {})
        attended = bool(attendance_map.get((player_key, matchday_number), False))
        if not attended and (
            int(bucket.get("goals", 0))
            or int(bucket.get("goal_keeps", 0))
            or bool(bucket.get("clean_sheet", False))
        ):
            attended = True
        stat_rows_out.append(
            {
                "matchday_number": matchday_number,
                "player_key": player_key,
                "first_name": str(payload["first_name"]),
                "last_name": str(payload["last_name"]),
                "attended": attended,
                "attendance_status": "in" if attended else "out",
                "goals": int(bucket.get("goals", 0)),
                "goal_keeps": int(bucket.get("goal_keeps", 0)),
                "clean_sheet": bool(bucket.get("clean_sheet", False)),
            }
        )
    dataset["stats"] = stat_rows_out

    dataset["matchdays"] = [
        {
            "matchday_number": matchday_number,
            "kickoff_at": f"{date_value} 12:00:00 America/Los_Angeles",
            "goals_count_as_points": matchday_number >= canonical.seed.GOALS_AS_POINTS_START,
        }
        for matchday_number, date_value in match_dates
    ]
    dataset["matches"] = [
        {
            "matchday_number": matchday_number,
            "round_number": round_number,
            "match_order": match_order,
            "home_team_code": home_team_code,
            "away_team_code": away_team_code,
            "home_score": home_score,
            "away_score": away_score,
        }
        for matchday_number, round_number, match_order, home_team_code, away_team_code, home_score, away_score in match_rows
    ]

    issue_counter = Counter(
        (
            issue["type"],
            issue.get("matchday_number"),
            issue.get("raw_label"),
            issue.get("source_kind"),
            issue.get("player_key"),
        )
        for issue in dataset["unresolved_labels"] + dataset["issues"]
    )
    deduped_issues = []
    seen_issue_keys: set[tuple[object, ...]] = set()
    for issue in dataset["unresolved_labels"]:
        dedupe_key = (
            str(issue["type"]),
            issue.get("matchday_number"),
            str(issue.get("raw_label", "")),
            str(issue.get("source_kind", "")),
            str(issue.get("player_key", "")),
        )
        if dedupe_key in seen_issue_keys:
            continue
        seen_issue_keys.add(dedupe_key)
        deduped_issues.append(
            {
                **issue,
                "count": issue_counter[dedupe_key],
            }
        )
    dataset["unresolved_labels"] = deduped_issues

    return dataset


def is_unknown_nationality(value: str) -> bool:
    return canonical.seed.normalize_label(value) in {"", "UNKNOWN"}


def positions_are_default_mid(values: list[str]) -> bool:
    return len(values) == 1 and canonical.seed.normalize_label(values[0]) == "MID"


def aggregate_players(season_datasets: list[dict[str, object]]) -> list[dict[str, object]]:
    players: dict[str, dict[str, object]] = {}

    for season_index, dataset in enumerate(season_datasets):
        season_player_map = {
            str(player["player_key"]): player for player in dataset["season_players"]
        }
        for player_key, payload in season_player_map.items():
            nickname = distinct_nickname(payload)
            nationality = canonical.seed.normalize_space(str(payload.get("nationality", ""))) or "Unknown"
            positions = normalized_positions(payload)
            tier_status = str(payload.get("tier_status") or payload.get("status") or "rotation")
            entry = players.setdefault(
                player_key,
                {
                    "player_key": player_key,
                    "first_name": str(payload["first_name"]),
                    "last_name": str(payload["last_name"]),
                    "nickname": nickname,
                    "nationality": nationality,
                    "positions": positions,
                    "desired_tier": tier_status,
                    "status": tier_status,
                    "latest_season_index": season_index,
                },
            )

            if season_index >= int(entry["latest_season_index"]):
                entry["first_name"] = str(payload["first_name"])
                entry["last_name"] = str(payload["last_name"])
                entry["desired_tier"] = tier_status
                entry["status"] = tier_status
                entry["latest_season_index"] = season_index
                if nickname is not None:
                    entry["nickname"] = nickname

            if entry.get("nickname") is None and nickname is not None:
                entry["nickname"] = nickname

            if season_index >= int(entry["latest_season_index"]) and not is_unknown_nationality(nationality):
                entry["nationality"] = nationality
            elif is_unknown_nationality(str(entry["nationality"])) and not is_unknown_nationality(nationality):
                entry["nationality"] = nationality

            if season_index >= int(entry["latest_season_index"]) and positions:
                entry["positions"] = positions
            elif positions and positions_are_default_mid(list(entry["positions"])) and not positions_are_default_mid(positions):
                entry["positions"] = positions

    rows = []
    for entry in players.values():
        rows.append(
            {
                "first_name": str(entry["first_name"]),
                "last_name": str(entry["last_name"]),
                "nickname": entry["nickname"],
                "nationality": str(entry["nationality"]),
                "positions": list(entry["positions"]),
                "desired_tier": str(entry["desired_tier"]),
                "status": str(entry["status"]),
            }
        )

    return sorted(
        rows,
        key=lambda row: (
            canonical.seed.normalize_space(str(row["last_name"])).lower(),
            canonical.seed.normalize_space(str(row["first_name"])).lower(),
            canonical.seed.normalize_space(str(row["nickname"] or "")).lower(),
        ),
    )


def player_seed_values_sql(players: list[dict[str, object]]) -> str:
    rows = [
        (
            f"({canonical.seed.sql_literal(str(player['first_name']))}, "
            f"{canonical.seed.sql_literal(str(player['last_name']))}, "
            f"{canonical.seed.sql_literal(player.get('nickname'))}, "
            f"{canonical.seed.sql_literal(str(player['nationality']))}, "
            f"{canonical.seed.sql_text_array(list(player['positions']))}, "
            f"{canonical.seed.sql_literal(str(player['desired_tier']))}, "
            f"{canonical.seed.sql_literal(str(player['status']))})"
        )
        for player in players
    ]
    return canonical.seed.values_block(
        rows,
        "first_name, last_name, nickname, nationality, positions, desired_tier, status",
    )


def typed_values_block(rows: list[str], columns: list[tuple[str, str]]) -> str:
    columns_sql = ", ".join(name for name, _ in columns)
    if rows:
        return canonical.seed.values_block(rows, columns_sql)
    null_select = ",\n    ".join(f"null::{column_type} as {name}" for name, column_type in columns)
    return f"(\n  select\n    {null_select}\n  where false\n)"


def build_player_upsert_sql(players: list[dict[str, object]]) -> str:
    values_sql = player_seed_values_sql(players)
    return f"""with player_seed as {values_sql}
update public.players p
set
  nickname = player_seed.nickname,
  nationality = player_seed.nationality,
  positions = player_seed.positions,
  desired_tier = player_seed.desired_tier,
  status = player_seed.status
from player_seed
where lower(trim(p.first_name)) = lower(trim(player_seed.first_name))
  and lower(trim(p.last_name)) = lower(trim(player_seed.last_name));

with player_seed as {values_sql}
insert into public.players (
  first_name,
  last_name,
  nickname,
  nationality,
  positions,
  desired_tier,
  status
)
select
  player_seed.first_name,
  player_seed.last_name,
  player_seed.nickname,
  player_seed.nationality,
  player_seed.positions,
  player_seed.desired_tier,
  player_seed.status
from player_seed
where not exists (
  select 1
  from public.players p
  where lower(trim(p.first_name)) = lower(trim(player_seed.first_name))
    and lower(trim(p.last_name)) = lower(trim(player_seed.last_name))
);"""


def build_season_sql_block(dataset: dict[str, object]) -> str:
    season_name = str(dataset["season_name"])
    season_players = list(dataset["season_players"])
    matchdays = list(dataset["matchdays"])
    matches = list(dataset["matches"])
    assignments = list(dataset["assignments"])
    stats = list(dataset["stats"])

    season_player_values_sql = typed_values_block(
        [
            (
                f"({canonical.seed.sql_literal(str(player['first_name']))}, "
                f"{canonical.seed.sql_literal(str(player['last_name']))}, "
                f"{canonical.seed.sql_literal(str(player['tier_status']))})"
            )
            for player in season_players
        ],
        [
            ("first_name", "text"),
            ("last_name", "text"),
            ("tier_status", "text"),
        ],
    )
    matchday_values_sql = typed_values_block(
        [
            (
                f"({int(matchday['matchday_number'])}, "
                f"timestamptz {canonical.seed.sql_literal(str(matchday['kickoff_at']))}, "
                f"{sql_bool(bool(matchday['goals_count_as_points']))})"
            )
            for matchday in matchdays
        ],
        [
            ("matchday_number", "integer"),
            ("kickoff_at", "timestamptz"),
            ("goals_count_as_points", "boolean"),
        ],
    )
    match_values_sql = typed_values_block(
        [
            (
                f"({int(match_row['matchday_number'])}, {int(match_row['round_number'])}, {int(match_row['match_order'])}, "
                f"{canonical.seed.sql_literal(match_row['home_team_code'])}, "
                f"{canonical.seed.sql_literal(match_row['away_team_code'])}, "
                f"{match_row['home_score'] if match_row['home_score'] is not None else 'null'}, "
                f"{match_row['away_score'] if match_row['away_score'] is not None else 'null'})"
            )
            for match_row in matches
        ],
        [
            ("matchday_number", "integer"),
            ("round_number", "integer"),
            ("match_order", "integer"),
            ("home_team_code", "text"),
            ("away_team_code", "text"),
            ("home_score", "integer"),
            ("away_score", "integer"),
        ],
    )
    assignment_values_sql = typed_values_block(
        [
            (
                f"({canonical.seed.sql_literal(str(row['first_name']))}, "
                f"{canonical.seed.sql_literal(str(row['last_name']))}, "
                f"{int(row['matchday_number'])}, "
                f"{canonical.seed.sql_literal(str(row['team_code']))})"
            )
            for row in assignments
        ],
        [
            ("first_name", "text"),
            ("last_name", "text"),
            ("matchday_number", "integer"),
            ("team_code", "text"),
        ],
    )
    stat_values_sql = typed_values_block(
        [
            (
                f"({canonical.seed.sql_literal(str(row['first_name']))}, "
                f"{canonical.seed.sql_literal(str(row['last_name']))}, "
                f"{int(row['matchday_number'])}, "
                f"{sql_bool(bool(row['attended']))}, "
                f"{canonical.seed.sql_literal(str(row['attendance_status']))}, "
                f"{int(row['goals'])}, "
                f"{int(row['goal_keeps'])}, "
                f"{sql_bool(bool(row['clean_sheet']))})"
            )
            for row in stats
        ],
        [
            ("first_name", "text"),
            ("last_name", "text"),
            ("matchday_number", "integer"),
            ("attended", "boolean"),
            ("attendance_status", "text"),
            ("goals", "integer"),
            ("goal_keeps", "integer"),
            ("clean_sheet", "boolean"),
        ],
    )

    core_spots = int(dataset["summary"]["core_spots"])
    rotation_spots = int(dataset["summary"]["rotation_spots"])

    return f"""-- ---------------------------------------------------------------------------
-- {season_name}
-- ---------------------------------------------------------------------------
delete from public.seasons
where lower(trim(name)) = lower({canonical.seed.sql_literal(season_name)});

insert into public.seasons (
  name,
  total_matchdays,
  core_spots,
  rotation_spots,
  model_start_matchday,
  attendance_points,
  win_points,
  draw_points,
  loss_points,
  goal_keep_points,
  team_goal_points
)
values (
  {canonical.seed.sql_literal(season_name)},
  {int(dataset['summary']['matchday_count'])},
  {core_spots},
  {rotation_spots},
  1,
  {canonical.seed.ATTENDANCE_POINTS},
  {canonical.seed.WIN_POINTS},
  {canonical.seed.DRAW_POINTS},
  {canonical.seed.LOSS_POINTS},
  {canonical.seed.GOAL_KEEP_POINTS},
  {canonical.seed.TEAM_GOAL_POINTS}
);

with season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower({canonical.seed.sql_literal(season_name)})
),
matchday_seed as {matchday_values_sql}
insert into public.matchdays (season_id, matchday_number, kickoff_at, goals_count_as_points)
select
  season_row.id,
  matchday_seed.matchday_number,
  matchday_seed.kickoff_at,
  matchday_seed.goals_count_as_points
from season_row
cross join matchday_seed;

with season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower({canonical.seed.sql_literal(season_name)})
),
matchday_lookup as (
  select md.id, md.matchday_number
  from public.matchdays md
  join season_row on season_row.id = md.season_id
),
match_seed as {match_values_sql}
insert into public.matchday_matches (
  matchday_id,
  round_number,
  match_order,
  home_team_code,
  away_team_code,
  home_score,
  away_score
)
select
  matchday_lookup.id,
  match_seed.round_number,
  match_seed.match_order,
  match_seed.home_team_code,
  match_seed.away_team_code,
  match_seed.home_score,
  match_seed.away_score
from match_seed
join matchday_lookup
  on matchday_lookup.matchday_number = match_seed.matchday_number;

with season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower({canonical.seed.sql_literal(season_name)})
),
season_player_seed as {season_player_values_sql}
insert into public.season_players (
  season_id,
  player_id,
  tier_status,
  tier_reason,
  movement_note,
  is_eligible
)
select distinct
  season_row.id,
  p.id,
  season_player_seed.tier_status,
  null,
  null,
  true
from season_row
join season_player_seed
  on true
join public.players p
  on lower(trim(p.first_name)) = lower(trim(season_player_seed.first_name))
 and lower(trim(p.last_name)) = lower(trim(season_player_seed.last_name));

with season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower({canonical.seed.sql_literal(season_name)})
),
matchday_lookup as (
  select md.id, md.matchday_number
  from public.matchdays md
  join season_row on season_row.id = md.season_id
),
assignment_seed as {assignment_values_sql}
insert into public.matchday_assignments (matchday_id, player_id, team_code)
select
  matchday_lookup.id,
  p.id,
  assignment_seed.team_code
from assignment_seed
join public.players p
  on lower(trim(p.first_name)) = lower(trim(assignment_seed.first_name))
 and lower(trim(p.last_name)) = lower(trim(assignment_seed.last_name))
join matchday_lookup
  on matchday_lookup.matchday_number = assignment_seed.matchday_number;

with season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower({canonical.seed.sql_literal(season_name)})
),
matchday_lookup as (
  select md.id, md.matchday_number
  from public.matchdays md
  join season_row on season_row.id = md.season_id
),
stat_seed as {stat_values_sql}
insert into public.matchday_player_stats (
  matchday_id,
  player_id,
  attended,
  attendance_status,
  goals,
  goal_keeps,
  clean_sheet
)
select
  matchday_lookup.id,
  p.id,
  stat_seed.attended,
  stat_seed.attendance_status,
  stat_seed.goals,
  stat_seed.goal_keeps,
  stat_seed.clean_sheet
from stat_seed
join public.players p
  on lower(trim(p.first_name)) = lower(trim(stat_seed.first_name))
 and lower(trim(p.last_name)) = lower(trim(stat_seed.last_name))
join matchday_lookup
  on matchday_lookup.matchday_number = stat_seed.matchday_number;"""


def build_seed_sql(
    step_title: str,
    description: str,
    season_datasets: list[dict[str, object]],
    player_rows: list[dict[str, object]],
) -> str:
    source_rows = "\n".join(
        f"-- {index}. {dataset['season_name']}: {dataset['workbook_path']}"
        for index, dataset in enumerate(season_datasets, start=1)
    )
    verification_rows = ",\n  ".join(
        f"exists (select 1 from public.seasons where lower(trim(name)) = lower({canonical.seed.sql_literal(str(dataset['season_name']))})) as {season_alias(str(dataset['season_name']))}"
        for dataset in season_datasets
    )
    season_blocks = "\n\n".join(build_season_sql_block(dataset) for dataset in season_datasets)

    return f"""-- {step_title}
-- {description}
-- Run this AFTER 01_schema.sql.
-- IMPORTANT: Set the dropdown to "No limit" before running.
-- Included workbooks:
{source_rows}
-- Canonical rebuild rules applied:
-- 1. Player identities come from data/reseed_config/identity_map.csv and approved workbook sources.
-- 2. Slash/buddy rows are duplicated into each real player.
-- 3. Placeholder labels like Unknown/Imported are ignored.
-- 4. Team assignment conflicts prefer direct single-player rows over slash/buddy placeholders.
-- 5. Each season is fully replaced from workbook data.

begin;

{build_player_upsert_sql(player_rows)}

{season_blocks}

commit;

select
  {verification_rows};"""


def validate_datasets(season_datasets: list[dict[str, object]]) -> None:
    blocking_messages: list[str] = []
    for dataset in season_datasets:
        season_name = str(dataset["season_name"])
        if not dataset["workbook_exists"]:
            blocking_messages.append(f"{season_name}: missing workbook")
        if dataset["missing_sheets"]:
            blocking_messages.append(
                f"{season_name}: missing sheets {', '.join(str(value) for value in dataset['missing_sheets'])}"
            )
        if dataset["unresolved_labels"]:
            blocking_messages.append(
                f"{season_name}: unresolved labels {', '.join(str(issue.get('raw_label', '')) for issue in dataset['unresolved_labels'][:5])}"
            )
        for issue in dataset["issues"]:
            issue_type = str(issue.get("type", ""))
            if issue_type in {"missing_workbook", "missing_sheets", "workbook_parse_error"}:
                blocking_messages.append(f"{season_name}: {issue_type}")

    if blocking_messages:
        raise SystemExit(
            "Canonical SQL generation blocked:\n- " + "\n- ".join(blocking_messages)
        )


def main() -> None:
    args = parse_args()
    config_root = args.config_root.expanduser().resolve()
    inventory_path = config_root / "season_inventory.csv"
    identity_map_path = config_root / "identity_map.csv"
    buddy_overrides_path = config_root / "buddy_overrides.csv"

    inventory_rows = canonical.parse_inventory_rows(inventory_path)
    if not args.include_not_ready:
        inventory_rows = [
            row for row in inventory_rows if canonical.normalize_bool(row.get("ready_for_import"))
        ]

    if not inventory_rows:
        raise SystemExit("No inventory rows selected for canonical SQL generation.")

    rule_players, alias_claims, ambiguous_aliases = canonical.parse_identity_map(identity_map_path)
    if ambiguous_aliases:
        raise SystemExit(
            "Canonical SQL generation blocked by ambiguous identity aliases:\n- "
            + "\n- ".join(
                f"{issue['alias']}: {', '.join(issue['canonical_names'])}" for issue in ambiguous_aliases
            )
        )

    overrides = canonical.parse_buddy_overrides(buddy_overrides_path)
    override_lookup = canonical.build_override_lookup(overrides)

    season_datasets = [
        build_canonical_season_dataset(row, rule_players, alias_claims, override_lookup)
        for row in inventory_rows
    ]
    validate_datasets(season_datasets)

    if len(season_datasets) == 1:
        history_datasets: list[dict[str, object]] = []
        current_datasets = season_datasets
    else:
        history_datasets = season_datasets[:-1]
        current_datasets = [season_datasets[-1]]

    history_players = aggregate_players(history_datasets) if history_datasets else []
    current_players = aggregate_players(current_datasets)

    history_output_path = args.history_output.expanduser().resolve()
    current_output_path = args.current_output.expanduser().resolve()
    history_output_path.parent.mkdir(parents=True, exist_ok=True)
    current_output_path.parent.mkdir(parents=True, exist_ok=True)

    if history_datasets:
        history_output_path.write_text(
            build_seed_sql(
                "STEP 2 OF 3: Seed canonical historical seasons.",
                "This file seeds every approved season before the current live season.",
                history_datasets,
                history_players,
            )
            + "\n",
            encoding="utf-8",
        )

    current_output_path.write_text(
        build_seed_sql(
            "STEP 3 OF 3: Seed canonical current season.",
            "This file seeds the latest approved season from the canonical rebuild source.",
            current_datasets,
            current_players,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {history_output_path}" if history_datasets else "Skipped history output")
    print(f"Wrote {current_output_path}")
    print(
        {
            "history_seasons": [dataset["season_name"] for dataset in history_datasets],
            "current_season": current_datasets[0]["season_name"],
            "history_player_count": len(history_players),
            "current_player_count": len(current_players),
            "history_assignment_rows": sum(len(dataset["assignments"]) for dataset in history_datasets),
            "current_assignment_rows": sum(len(dataset["assignments"]) for dataset in current_datasets),
            "history_normalized_assignment_conflicts": sum(
                int(dataset["summary"]["normalized_assignment_conflicts"]) for dataset in history_datasets
            ),
            "current_normalized_assignment_conflicts": sum(
                int(dataset["summary"]["normalized_assignment_conflicts"]) for dataset in current_datasets
            ),
            "history_stat_rows": sum(len(dataset["stats"]) for dataset in history_datasets),
            "current_stat_rows": sum(len(dataset["stats"]) for dataset in current_datasets),
        }
    )


if __name__ == "__main__":
    main()
