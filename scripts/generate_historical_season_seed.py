#!/usr/bin/env python3
from __future__ import annotations

import csv
import argparse
import importlib.util
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parent.parent
SQL_ROOT = ROOT / "sql"
ARCHIVE_SQL_ROOT = SQL_ROOT / "archive"
BASE_SCRIPT_PATH = ROOT / "scripts" / "generate_2026_spring_seed.py"
GOALS_AS_POINTS_START = 5
ATTENDANCE_POINTS = 2
WIN_POINTS = 2
DRAW_POINTS = 1
LOSS_POINTS = 0
GOAL_KEEP_POINTS = 1
TEAM_GOAL_POINTS = 1
HISTORICAL_TIER_REASON = "Historical import from a pre-tier workbook."
HISTORICAL_MOVEMENT_NOTE = "Imported for archive only. Review manually before using this player in a live season."


def load_base_module():
    spec = importlib.util.spec_from_file_location("season_seed_base", BASE_SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {BASE_SCRIPT_PATH}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


seed = load_base_module()
ORIGINAL_CANONICAL_IDENTITY = seed.canonical_identity


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a season-scoped historical SQL seed from a Mandarinas workbook.")
    parser.add_argument("workbook", type=Path, help="Path to the source .xlsx workbook")
    parser.add_argument("season_name", help="Season name to store in Supabase")
    parser.add_argument(
        "--output",
        type=Path,
        help="Output .sql path. Defaults to season_<normalized_name>_seed.sql in the repo root.",
    )
    parser.add_argument(
        "--alias-workbook",
        action="append",
        default=[],
        help="Optional extra workbook path with PLAYER_PROFILE rows to improve nickname-to-full-name matching.",
    )
    return parser.parse_args()


def default_output_path(season_name: str) -> Path:
    slug = re.sub(r"[^a-z0-9]+", "_", season_name.lower()).strip("_")
    return ARCHIVE_SQL_ROOT / f"season_{slug}_seed.sql"


def normalize_import_label(import_label: str) -> str:
    cleaned = seed.normalize_import_label(import_label)
    tokens = cleaned.split()

    while tokens and tokens[0] in {"🏆", "🥈", "🥉"}:
        tokens.pop(0)

    cleaned = " ".join(tokens)
    cleaned = re.sub(r"\s*/\s*", " / ", cleaned)
    cleaned = seed.normalize_space(cleaned).strip("/ ")
    return cleaned


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char))


def simplified_label_key(value: str) -> str:
    cleaned = normalize_import_label(value)
    cleaned = cleaned.replace("’", "'")
    cleaned = re.sub(r"(?<=\w)'(?=\w)", "", cleaned)
    cleaned = cleaned.replace(".", " ")
    cleaned = strip_accents(cleaned)
    return seed.normalize_label(seed.normalize_space(cleaned))


def base_player_label(import_label: str) -> str:
    cleaned = normalize_import_label(import_label)
    if cleaned.upper().startswith("(SUB)"):
        cleaned = seed.normalize_space(cleaned[5:])
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = seed.normalize_space(cleaned[1:-1])
    cleaned = cleaned.replace("’", "'")
    cleaned = re.sub(r"(?<=\w)'(?=\w)", "", cleaned)
    cleaned = seed.normalize_space(cleaned)
    if seed.normalize_label(cleaned) in {"UNKNOWN", "N/A"}:
        return ""
    return cleaned


def split_player_labels(import_label: str) -> list[str]:
    base_label = base_player_label(import_label)
    if not base_label:
        return []
    return [
        seed.normalize_label(part)
        for part in re.split(r"\s*/\s*", base_label)
        if seed.normalize_space(part)
    ]


def status_from_import_label(import_label: str) -> str:
    clean_label = seed.normalize_space(import_label)
    base_label = base_player_label(clean_label)

    if clean_label.upper().startswith("(SUB)") or (clean_label.startswith("(") and clean_label.endswith(")")):
        return "sub"

    if "/" in base_label:
        return "flex"

    return "flex"


def canonical_identity_from_full_name(full_name: str, nickname: str | None = None, status: str = "flex"):
    normalized_name = seed.normalize_space(full_name)
    safe_nickname = seed.normalize_space(nickname or "") or None
    parts = normalized_name.split()
    if len(parts) == 1:
        first_name = seed.pretty_token(parts[0])
        last_name = "Player"
    else:
        first_name = seed.pretty_token(" ".join(parts[:-1]))
        last_name = seed.pretty_token(parts[-1])

    if len(last_name.strip()) < 2:
        last_name = "Player"

    if len(first_name.strip()) < 2:
        if len(parts) >= 2 and len(seed.pretty_token(parts[-1]).strip()) >= 2:
            first_name = seed.pretty_token(parts[-1])
            last_name = "Player"
        elif safe_nickname and len(seed.pretty_token(safe_nickname).strip()) >= 2:
            first_name = seed.pretty_token(safe_nickname)
            last_name = "Player"
        else:
            first_name = "Player"

    return seed.PlayerIdentity(first_name[:40], last_name[:40], (safe_nickname or normalized_name)[:50], status)


def parse_profile_rows(rows: list[list[str]]) -> dict[str, object]:
    if not rows:
        return {}

    header = rows[0]
    header_map = {seed.normalize_space(value): index for index, value in enumerate(header)}
    player_name_idx = header_map.get("PlayerName")
    nickname_idx = header_map.get("Nickname")

    if player_name_idx is None:
        return {}

    explicit_aliases: dict[str, object] = {}
    first_name_candidates: dict[str, list[object]] = defaultdict(list)

    for row in rows[1:]:
        full_name = seed.normalize_space(seed.safe_cell(row, player_name_idx))
        nickname = seed.normalize_space(seed.safe_cell(row, nickname_idx)) if nickname_idx is not None else ""
        if not full_name:
            continue

        identity = canonical_identity_from_full_name(full_name, nickname or None, "flex")
        aliases = {
            seed.normalize_label(full_name),
            seed.normalize_label(normalize_import_label(full_name)),
            simplified_label_key(full_name),
        }

        if nickname:
            aliases.add(seed.normalize_label(nickname))
            aliases.add(seed.normalize_label(normalize_import_label(nickname)))
            aliases.add(simplified_label_key(nickname))

        first_name_alias = seed.normalize_label(identity.first_name)
        if first_name_alias:
            first_name_candidates[first_name_alias].append(identity)
            first_name_candidates[simplified_label_key(identity.first_name)].append(identity)

        for alias in aliases:
            if alias:
                explicit_aliases[alias] = identity

    for alias, identities in first_name_candidates.items():
        unique_identities = {
            (identity.first_name, identity.last_name, identity.nickname): identity for identity in identities
        }
        if len(unique_identities) == 1 and alias not in explicit_aliases:
            explicit_aliases[alias] = next(iter(unique_identities.values()))

    return explicit_aliases


def load_profile_aliases(workbook_paths: Iterable[Path]) -> dict[str, object]:
    alias_map: dict[str, object] = {}

    for workbook_path in workbook_paths:
        if not workbook_path.exists():
            continue

        workbook = seed.WorkbookReader(workbook_path)
        try:
            if "PLAYER_PROFILE" not in workbook.sheet_members:
                continue
            alias_map.update(parse_profile_rows(workbook.read_rows("PLAYER_PROFILE")))
        finally:
            workbook.close()

    return alias_map


def parse_registry_aliases(csv_path: Path | None) -> dict[str, object]:
    if csv_path is None or not csv_path.exists():
        return {}

    explicit_aliases: dict[str, object] = {}
    first_name_candidates: dict[str, list[object]] = defaultdict(list)

    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            player_name = seed.normalize_space(row.get("player_name", ""))
            if not player_name:
                continue

            parts = player_name.split()
            identity = canonical_identity_from_full_name(player_name, player_name, "flex")
            aliases = {
                seed.normalize_label(player_name),
                simplified_label_key(player_name),
            }

            first_name_alias = simplified_label_key(identity.first_name)
            if first_name_alias:
                first_name_candidates[first_name_alias].append(identity)

            nickname_alias = simplified_label_key(identity.nickname or "")
            if nickname_alias:
                aliases.add(nickname_alias)

            for alias in aliases:
                if alias:
                    explicit_aliases[alias] = identity

    for alias, identities in first_name_candidates.items():
        unique_identities = {
            (identity.first_name, identity.last_name, identity.nickname): identity for identity in identities
        }
        if len(unique_identities) == 1 and alias not in explicit_aliases:
            explicit_aliases[alias] = next(iter(unique_identities.values()))

    return explicit_aliases


def merge_registry_aliases(profile_aliases: dict[str, object], registry_aliases: dict[str, object]) -> dict[str, object]:
    merged = dict(profile_aliases)
    rich_first_names = {
        simplified_label_key(identity.first_name)
        for identity in merged.values()
        if identity.last_name != "Player"
    }

    for alias_key, identity in registry_aliases.items():
        first_name_key = simplified_label_key(identity.first_name)
        if identity.last_name == "Player" and first_name_key in rich_first_names:
            continue
        merged.setdefault(alias_key, identity)
        if identity.last_name != "Player":
            rich_first_names.add(first_name_key)

    return merged


def canonical_identity_factory(profile_aliases: dict[str, object]):
    unique_profile_identities = {
        (identity.first_name, identity.last_name, identity.nickname): identity for identity in profile_aliases.values()
    }
    prefix_candidates = [
        (
            {
                simplified_label_key(identity.first_name),
                simplified_label_key(identity.nickname or ""),
                simplified_label_key(f"{identity.first_name} {identity.last_name}"),
            },
            identity,
        )
        for identity in unique_profile_identities.values()
    ]

    def canonical_identity(import_label: str):
        base_label = base_player_label(import_label)
        status = status_from_import_label(import_label)

        if not base_label:
            base_label = "Imported Player"

        profile_identity = profile_aliases.get(seed.normalize_label(base_label))
        if profile_identity is None:
            profile_identity = profile_aliases.get(simplified_label_key(base_label))

        if profile_identity is None:
            tokens = [token for token in re.split(r"\s+", base_label.replace(".", " ")) if token]
            if len(tokens) == 2 and len(tokens[1]) == 1:
                first_name_key = simplified_label_key(tokens[0])
                last_initial = seed.normalize_label(tokens[1])[0]
                matches = [
                    identity
                    for identity in unique_profile_identities.values()
                    if simplified_label_key(identity.first_name) == first_name_key
                    and seed.normalize_label(identity.last_name).startswith(last_initial)
                ]
                if len(matches) == 1:
                    profile_identity = matches[0]

        if profile_identity is None:
            base_key = simplified_label_key(base_label)
            if len(base_key) >= 4:
                matches = [
                    identity
                    for candidate_keys, identity in prefix_candidates
                    if any(
                        candidate_key
                        and len(candidate_key) >= len(base_key)
                        and candidate_key.startswith(base_key)
                        for candidate_key in candidate_keys
                    )
                ]
                unique_matches = {
                    (identity.first_name, identity.last_name, identity.nickname): identity for identity in matches
                }
                if len(unique_matches) == 1:
                    profile_identity = next(iter(unique_matches.values()))

        if profile_identity is not None:
            return seed.PlayerIdentity(
                profile_identity.first_name,
                profile_identity.last_name,
                profile_identity.nickname,
                status,
            )

        return ORIGINAL_CANONICAL_IDENTITY(base_label)

    return canonical_identity


def values_block(rows: list[str], columns_sql: str) -> str:
    column_count = len([column.strip() for column in columns_sql.split(",")])
    if rows:
        return "(\n  select *\n  from (\n    values\n      " + ",\n      ".join(rows) + f"\n  ) as seed({columns_sql})\n)"
    null_row = ", ".join("null" for _ in range(column_count))
    return f"(\n  select *\n  from (\n    values ({null_row})\n  ) as seed({columns_sql})\n  where false\n)"


def build_sql(workbook_path: Path, season_name: str, alias_workbooks: list[Path]) -> str:
    profile_aliases = merge_registry_aliases(
        load_profile_aliases([workbook_path, *alias_workbooks]),
        parse_registry_aliases(seed.resolve_player_csv_path()),
    )
    player_profiles = seed.parse_player_profiles(seed.resolve_player_csv_path())

    seed.base_player_label = base_player_label
    seed.split_player_labels = split_player_labels
    seed.status_from_import_label = status_from_import_label
    seed.canonical_identity = canonical_identity_factory(profile_aliases)

    workbook = seed.WorkbookReader(workbook_path)
    try:
        match_dates = seed.parse_match_dates(workbook.read_rows("MATCH_DATES"))
        total_matchdays = max((matchday_number for matchday_number, _ in match_dates), default=8)
        goals_as_points_matchdays = {
            matchday_number for matchday_number, _ in match_dates if matchday_number >= GOALS_AS_POINTS_START
        }

        player_map, assignments, attendance_rows, resolved_map = seed.parse_weekly_teams(
            workbook.read_rows("WEEKLY_TEAMS"),
            total_matchdays,
        )
        stats_by_key = seed.parse_player_stats(workbook.read_rows("PLAYER_STAT"), resolved_map)
        match_rows = seed.parse_match_rows(workbook.read_rows("MATCH_INPUT"))
    finally:
        workbook.close()

    attendance_map = {(label, matchday_number): attended for label, matchday_number, attended in attendance_rows}
    stat_keys = set(attendance_map) | set(stats_by_key)

    stat_values_rows = []
    for import_label, matchday_number in sorted(stat_keys, key=lambda item: (item[1], item[0])):
        goals, goal_keeps, clean_sheet = stats_by_key.get((import_label, matchday_number), (0, 0, False))
        attended = attendance_map.get(
            (import_label, matchday_number),
            True if (import_label, matchday_number) in stats_by_key else False,
        )
        stat_values_rows.append(
            (
                import_label,
                matchday_number,
                attended,
                "attended" if attended else "out",
                goals,
                goal_keeps,
                clean_sheet,
            )
        )

    sorted_aliases = sorted(
        player_map.items(),
        key=lambda item: (item[0].lower(), item[1].last_name.lower(), item[1].first_name.lower()),
    )

    # Deduplicate aliases: keep only one alias per unique (first_name, last_name) pair
    # This prevents unique constraint violations when the same player has multiple aliases
    seen_identities = {}
    deduplicated_aliases = []
    removed_aliases = {}  # Maps removed alias -> canonical alias for remapping
    for import_label, identity in sorted_aliases:
        identity_key = (identity.first_name, identity.last_name)
        if identity_key not in seen_identities:
            seen_identities[identity_key] = import_label
            deduplicated_aliases.append((import_label, identity))
        else:
            # This alias maps to the same player as a previously seen alias
            # Remap it to the canonical alias
            canonical_alias = seen_identities[identity_key]
            removed_aliases[import_label] = canonical_alias

    sorted_players = sorted(
        (identity for _, identity in deduplicated_aliases),
        key=lambda identity: (identity.last_name.lower(), identity.first_name.lower(), (identity.nickname or "").lower()),
    )
    rotation_spots = max(1, min(len(sorted_players), 60))

    player_value_rows = [
        f"({seed.sql_literal(identity.first_name)}, {seed.sql_literal(identity.last_name)}, {seed.sql_literal(identity.nickname)}, "
        f"{seed.sql_literal(seed.identity_profile(identity, player_profiles).nationality)}, "
        f"{seed.sql_text_array(seed.identity_profile(identity, player_profiles).positions)}, "
        f"{seed.sql_literal(identity.status)}, {seed.sql_literal(identity.status)})"
        for identity in sorted_players
    ]

    alias_value_rows = [
        f"({seed.sql_literal(import_label)}, {seed.sql_literal(identity.first_name)}, {seed.sql_literal(identity.last_name)})"
        for import_label, identity in deduplicated_aliases
    ]

    matchday_value_rows = [
        f"({matchday_number}, timestamptz {seed.sql_literal(date_value + ' 12:00:00 America/Los_Angeles')}, "
        f"{'true' if matchday_number in goals_as_points_matchdays else 'false'})"
        for matchday_number, date_value in match_dates
    ]

    match_value_rows = [
        f"({matchday_number}, {round_number}, {match_order}, {seed.sql_literal(home_team)}, {seed.sql_literal(away_team)}, "
        f"{home_score if home_score is not None else 'null'}, {away_score if away_score is not None else 'null'})"
        for matchday_number, round_number, match_order, home_team, away_team, home_score, away_score in match_rows
    ]

    # Remap assignments and stats for removed aliases to use their canonical alias
    remapped_assignments = []
    seen_assignment_keys = set()
    for import_label, matchday_number, team_code in assignments:
        # Use canonical alias if this one was removed
        canonical_label = removed_aliases.get(import_label, import_label)
        assignment_key = (canonical_label, matchday_number)
        # Skip duplicate assignments for the same matchday (keep first)
        if assignment_key not in seen_assignment_keys:
            remapped_assignments.append((canonical_label, matchday_number, team_code))
            seen_assignment_keys.add(assignment_key)

    remapped_stats = []
    seen_stat_keys = set()
    for import_label, matchday_number, attended, attendance_status, goals, goal_keeps, clean_sheet in stat_values_rows:
        # Use canonical alias if this one was removed
        canonical_label = removed_aliases.get(import_label, import_label)
        stat_key = (canonical_label, matchday_number)
        # Skip duplicate stats for the same matchday (keep first)
        if stat_key not in seen_stat_keys:
            remapped_stats.append((canonical_label, matchday_number, attended, attendance_status, goals, goal_keeps, clean_sheet))
            seen_stat_keys.add(stat_key)

    assignment_value_rows = [
        f"({seed.sql_literal(import_label)}, {matchday_number}, {seed.sql_literal(team_code)})"
        for import_label, matchday_number, team_code in remapped_assignments
    ]

    stat_value_rows = [
        f"({seed.sql_literal(import_label)}, {matchday_number}, {'true' if attended else 'false'}, "
        f"{seed.sql_literal(attendance_status)}, {goals}, {goal_keeps}, {'true' if clean_sheet else 'false'})"
        for import_label, matchday_number, attended, attendance_status, goals, goal_keeps, clean_sheet in remapped_stats
    ]

    season_player_value_rows = [
        f"({seed.sql_literal(import_label)}, {seed.sql_literal(identity.status)})"
        for import_label, identity in deduplicated_aliases
    ]

    player_values_sql = values_block(
        player_value_rows,
        "first_name, last_name, nickname, nationality, positions, desired_tier, status",
    )
    alias_values_sql = values_block(alias_value_rows, "import_label, first_name, last_name")
    matchday_values_sql = values_block(matchday_value_rows, "matchday_number, kickoff_at, goals_count_as_points")
    match_values_sql = values_block(
        match_value_rows,
        "matchday_number, round_number, match_order, home_team_code, away_team_code, home_score, away_score",
    )
    assignment_values_sql = values_block(assignment_value_rows, "import_label, matchday_number, team_code")
    stat_values_sql = values_block(
        stat_value_rows,
        "import_label, matchday_number, attended, attendance_status, goals, goal_keeps, clean_sheet",
    )
    season_player_values_sql = values_block(season_player_value_rows, "import_label, tier_status")

    return f"""-- Historical season seed generated from a Mandarinas workbook.
-- Source workbook: {workbook_path}
-- Season name: {season_name}
-- Historical rules applied:
-- 1. Only the target season is deleted and recreated. Existing players stay in place.
-- 2. Buddy labels resolve to one real player per matchday. The full buddy-slot stats stay with that selected player.
-- 3. Historical imports do not assign anyone to Core. Imported players default to Flex unless they were explicitly a sub.
-- 4. This seed is for archive/history only. Current-season live tiers still need to be managed in the app.

begin;

delete from public.seasons
where lower(trim(name)) = lower({seed.sql_literal(season_name)});

with player_seed as {player_values_sql}
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
);

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
  {seed.sql_literal(season_name)},
  {total_matchdays},
  0,
  {rotation_spots},
  1,
  {ATTENDANCE_POINTS},
  {WIN_POINTS},
  {DRAW_POINTS},
  {LOSS_POINTS},
  {GOAL_KEEP_POINTS},
  {TEAM_GOAL_POINTS}
);

with season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower({seed.sql_literal(season_name)})
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
  where lower(trim(name)) = lower({seed.sql_literal(season_name)})
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

with player_aliases as {alias_values_sql},
player_lookup as (
  select
    player_aliases.import_label,
    p.id as player_id
  from player_aliases
  join public.players p
    on lower(trim(p.first_name)) = lower(trim(player_aliases.first_name))
   and lower(trim(p.last_name)) = lower(trim(player_aliases.last_name))
),
season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower({seed.sql_literal(season_name)})
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
  player_lookup.player_id,
  assignment_seed.team_code
from assignment_seed
join player_lookup
  on player_lookup.import_label = assignment_seed.import_label
join matchday_lookup
  on matchday_lookup.matchday_number = assignment_seed.matchday_number;

with player_aliases as {alias_values_sql},
player_lookup as (
  select
    player_aliases.import_label,
    p.id as player_id
  from player_aliases
  join public.players p
    on lower(trim(p.first_name)) = lower(trim(player_aliases.first_name))
   and lower(trim(p.last_name)) = lower(trim(player_aliases.last_name))
),
season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower({seed.sql_literal(season_name)})
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
  player_lookup.player_id,
  stat_seed.attended,
  stat_seed.attendance_status,
  stat_seed.goals,
  stat_seed.goal_keeps,
  stat_seed.clean_sheet
from stat_seed
join player_lookup
  on player_lookup.import_label = stat_seed.import_label
join matchday_lookup
  on matchday_lookup.matchday_number = stat_seed.matchday_number;

with player_aliases as {alias_values_sql},
player_lookup as (
  select
    player_aliases.import_label,
    p.id as player_id
  from player_aliases
  join public.players p
    on lower(trim(p.first_name)) = lower(trim(player_aliases.first_name))
   and lower(trim(p.last_name)) = lower(trim(player_aliases.last_name))
),
season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower({seed.sql_literal(season_name)})
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
  player_lookup.player_id,
  season_player_seed.tier_status,
  {seed.sql_literal(HISTORICAL_TIER_REASON)},
  {seed.sql_literal(HISTORICAL_MOVEMENT_NOTE)},
  true
from season_row
join season_player_seed
  on true
join player_lookup
  on player_lookup.import_label = season_player_seed.import_label;

commit;
"""


def main() -> None:
    args = parse_args()
    workbook_path = args.workbook.expanduser().resolve()
    if not workbook_path.exists():
        raise FileNotFoundError(workbook_path)

    alias_workbooks = [Path(path).expanduser().resolve() for path in args.alias_workbook]
    output_path = (args.output or default_output_path(args.season_name)).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(build_sql(workbook_path, args.season_name, alias_workbooks), encoding="utf-8")
    print(f"Wrote {output_path} from {workbook_path}")


if __name__ == "__main__":
    main()
