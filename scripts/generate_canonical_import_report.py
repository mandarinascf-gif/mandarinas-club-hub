#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import re
from typing import Iterable

import generate_2026_spring_seed as seed
import generate_historical_season_seed as historical


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_ROOT = ROOT / "data" / "reseed_config"
DEFAULT_REPORT_ROOT = ROOT / "data" / "reseed_reports"
WEEKLY_SHEET_CANDIDATES = ("WEEKLY_TEAMS", "WEEKLY_ROSTER")
MATCH_DATE_SHEET_CANDIDATES = ("MATCH_DATES", "MATCH DATES")
OPTIONAL_REFERENCE_PROFILE_DIR = ROOT / "data" / "reseed_source" / "reference_profiles"
REQUIRED_SHEETS = ("MATCH_INPUT",)
IGNORED_PLACEHOLDER_LABELS = frozenset({"UNKNOWN", "IMPORTED", "IMPORTED PLAYER"})


@dataclass(frozen=True)
class CanonicalPlayerRule:
    canonical_name: str
    first_name: str
    last_name: str
    nickname: str | None
    merge_sub_into_canonical: bool
    preferred_nationality: str
    preferred_positions: tuple[str, ...]
    default_tier: str
    notes: str


@dataclass(frozen=True)
class BuddyOverride:
    season_name: str
    matchday_number: int
    raw_label: str
    actual_player: str
    team_code: str
    reason: str
    notes: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a dry-run multi-season canonical import report from workbook exports."
    )
    parser.add_argument(
        "--config-root",
        type=Path,
        default=DEFAULT_CONFIG_ROOT,
        help="Folder containing season_inventory.csv, identity_map.csv, and buddy_overrides.csv.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_REPORT_ROOT / "canonical_import_report.json",
        help="JSON report path to write.",
    )
    parser.add_argument(
        "--markdown-output",
        type=Path,
        default=DEFAULT_REPORT_ROOT / "canonical_import_report.md",
        help="Markdown summary path to write.",
    )
    parser.add_argument(
        "--include-not-ready",
        action="store_true",
        help="Include inventory rows marked ready_for_import != yes in the report.",
    )
    parser.add_argument(
        "--fail-on-issues",
        action="store_true",
        help="Exit non-zero when the generated report is not ready for a destructive reseed.",
    )
    return parser.parse_args()


def normalize_bool(value: str | None) -> bool:
    return seed.normalize_label(value or "") in {"1", "TRUE", "YES", "Y"}


def split_semicolon_list(value: str | None) -> list[str]:
    return [seed.normalize_space(part) for part in (value or "").split(";") if seed.normalize_space(part)]


def identity_key(first_name: str, last_name: str) -> str:
    return f"{seed.normalize_label(first_name)}|{seed.normalize_label(last_name)}"


def display_name(first_name: str, last_name: str, nickname: str | None = None) -> str:
    normalized_nickname = seed.normalize_space(nickname or "")
    if normalized_nickname:
        return normalized_nickname
    normalized_first = seed.normalize_space(first_name)
    normalized_last = seed.normalize_space(last_name)
    if normalized_last.lower() in {"player", "sub", ""}:
        return normalized_first
    return seed.normalize_space(f"{normalized_first} {normalized_last}")


def safe_identity_from_actual_player(actual_player: str) -> seed.PlayerIdentity:
    actual_player = seed.normalize_space(actual_player)
    if not actual_player:
        return seed.PlayerIdentity("Player", "Player", "Player", "rotation")
    return historical.canonical_identity_from_full_name(actual_player, actual_player, "rotation")


def resolve_weekly_sheet_name(workbook: seed.WorkbookReader) -> str | None:
    for candidate in WEEKLY_SHEET_CANDIDATES:
        if candidate in workbook.sheet_members:
            return candidate
    return None


def resolve_match_dates_sheet_name(workbook: seed.WorkbookReader) -> str | None:
    for candidate in MATCH_DATE_SHEET_CANDIDATES:
        if candidate in workbook.sheet_members:
            return candidate
    return None


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def parse_inventory_rows(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for row in read_csv_rows(path):
        season_name = seed.normalize_space(row.get("season_name", ""))
        if not season_name:
            continue
        rows.append(row)
    return rows


def parse_identity_map(
    path: Path,
) -> tuple[dict[str, CanonicalPlayerRule], dict[str, set[str]], list[dict[str, object]]]:
    players: dict[str, CanonicalPlayerRule] = {}
    alias_claims: dict[str, set[str]] = defaultdict(set)

    for row in read_csv_rows(path):
        canonical_name = seed.normalize_space(row.get("canonical_name", ""))
        first_name = seed.normalize_space(row.get("first_name", "")) or canonical_name or "Player"
        last_name = seed.normalize_space(row.get("last_name", "")) or "Player"
        nickname = seed.normalize_space(row.get("nickname", "")) or None
        if not canonical_name:
            canonical_name = display_name(first_name, last_name, nickname)

        player = CanonicalPlayerRule(
            canonical_name=canonical_name,
            first_name=first_name,
            last_name=last_name,
            nickname=nickname,
            merge_sub_into_canonical=normalize_bool(row.get("merge_sub_into_canonical")),
            preferred_nationality=seed.normalize_space(row.get("preferred_nationality", "")) or "Unknown",
            preferred_positions=tuple(split_semicolon_list(row.get("preferred_positions")) or ["MID"]),
            default_tier=seed.normalize_space(row.get("default_tier", "")) or "rotation",
            notes=seed.normalize_space(row.get("notes", "")),
        )
        player_key = seed.normalize_label(player.canonical_name)
        players[player_key] = player

        aliases = {
            player.canonical_name,
            display_name(player.first_name, player.last_name, player.nickname),
        }
        if player.nickname:
            aliases.add(player.nickname)
        aliases.update(split_semicolon_list(row.get("aliases")))

        for alias in aliases:
            normalized_alias = seed.normalize_label(alias)
            simplified_alias = historical.simplified_label_key(alias)
            if normalized_alias:
                alias_claims[normalized_alias].add(player_key)
            if simplified_alias:
                alias_claims[simplified_alias].add(player_key)

    ambiguous_aliases = [
        {
            "alias": alias,
            "canonical_names": sorted(players[player_key].canonical_name for player_key in owner_keys),
            "is_expected_buddy_alias": "/" in alias,
        }
        for alias, owner_keys in sorted(alias_claims.items())
        if len(owner_keys) > 1
    ]
    return players, alias_claims, ambiguous_aliases


def parse_buddy_overrides(path: Path) -> list[BuddyOverride]:
    overrides: list[BuddyOverride] = []
    for row in read_csv_rows(path):
        season_name = seed.normalize_space(row.get("season_name", ""))
        raw_label = seed.normalize_import_label(row.get("raw_label", ""))
        actual_player = seed.normalize_space(row.get("actual_player", ""))
        if not season_name or not raw_label or not actual_player:
            continue
        overrides.append(
            BuddyOverride(
                season_name=season_name,
                matchday_number=seed.parse_int(row.get("matchday_number")) or 0,
                raw_label=raw_label,
                actual_player=actual_player,
                team_code=seed.normalize_space(row.get("team_code", "")),
                reason=seed.normalize_space(row.get("reason", "")),
                notes=seed.normalize_space(row.get("notes", "")),
            )
        )
    return overrides


def build_override_lookup(overrides: Iterable[BuddyOverride]) -> dict[tuple[str, int, str], BuddyOverride]:
    lookup: dict[tuple[str, int, str], BuddyOverride] = {}
    for override in overrides:
        key = (
            seed.normalize_label(override.season_name),
            override.matchday_number,
            seed.normalize_label(override.raw_label),
        )
        lookup[key] = override
    return lookup


def canonical_player_payload(
    player: CanonicalPlayerRule,
    source: str,
) -> dict[str, object]:
    return {
        "player_key": identity_key(player.first_name, player.last_name),
        "canonical_name": player.canonical_name,
        "first_name": player.first_name,
        "last_name": player.last_name,
        "nickname": player.nickname,
        "display_name": display_name(player.first_name, player.last_name, player.nickname),
        "nationality": player.preferred_nationality,
        "positions": list(player.preferred_positions),
        "default_tier": player.default_tier,
        "status": player.default_tier,
        "source": source,
    }


def auto_player_payload(identity: seed.PlayerIdentity, profile: seed.PlayerProfile) -> dict[str, object]:
    return {
        "player_key": identity_key(identity.first_name, identity.last_name),
        "canonical_name": display_name(identity.first_name, identity.last_name, identity.nickname),
        "first_name": identity.first_name,
        "last_name": identity.last_name,
        "nickname": identity.nickname,
        "display_name": display_name(identity.first_name, identity.last_name, identity.nickname),
        "nationality": profile.nationality,
        "positions": list(profile.positions),
        "default_tier": identity.status,
        "status": identity.status,
        "source": "auto",
    }


class SeasonResolver:
    def __init__(
        self,
        season_name: str,
        workbook_path: Path,
        rule_players: dict[str, CanonicalPlayerRule],
        alias_claims: dict[str, set[str]],
        override_lookup: dict[tuple[str, int, str], BuddyOverride],
    ) -> None:
        self.season_name = season_name
        self.workbook_path = workbook_path
        self.rule_players = rule_players
        self.alias_claims = alias_claims
        self.override_lookup = override_lookup
        self.used_override_keys: set[tuple[str, int, str]] = set()
        reference_workbooks = sorted(OPTIONAL_REFERENCE_PROFILE_DIR.glob("*.xlsx"))
        profile_aliases = historical.merge_registry_aliases(
            historical.load_profile_aliases([workbook_path, *reference_workbooks]),
            historical.parse_registry_aliases(seed.resolve_player_csv_path()),
        )
        self.auto_identity = historical.canonical_identity_factory(profile_aliases)
        self.player_profiles = seed.parse_player_profiles(seed.resolve_player_csv_path())

    def find_rule_player(self, label: str) -> CanonicalPlayerRule | None:
        raw_key = seed.normalize_label(label)
        simplified_key = historical.simplified_label_key(label)
        matches = set()
        if raw_key:
            matches.update(self.alias_claims.get(raw_key, set()))
        if simplified_key:
            matches.update(self.alias_claims.get(simplified_key, set()))
        if len(matches) == 1:
            return self.rule_players[next(iter(matches))]
        return None

    def resolve_actual_player(self, actual_player: str) -> dict[str, object]:
        rule_player = self.find_rule_player(actual_player)
        if rule_player is not None:
            return canonical_player_payload(rule_player, "buddy_override")
        identity = safe_identity_from_actual_player(actual_player)
        profile = seed.identity_profile(identity, self.player_profiles)
        payload = auto_player_payload(identity, profile)
        payload["source"] = "buddy_override_auto"
        return payload

    def resolve_label(
        self,
        raw_label: str,
        matchday_number: int | None,
        source_kind: str,
    ) -> tuple[list[dict[str, object]] | None, dict[str, object] | None]:
        normalized_label = seed.normalize_import_label(raw_label)
        if not normalized_label:
            return None, {
                "type": "blank_label",
                "source_kind": source_kind,
                "matchday_number": matchday_number,
                "raw_label": raw_label,
                "reason": "Blank player label.",
            }

        base_label_key = seed.normalize_label(seed.base_player_label(normalized_label))
        if base_label_key in IGNORED_PLACEHOLDER_LABELS:
            return None, None

        direct_rule_player = self.find_rule_player(normalized_label)
        if direct_rule_player is None and seed.is_sub_import_label(normalized_label):
            direct_rule_player = self.find_rule_player(seed.base_player_label(normalized_label))
        if direct_rule_player is not None and "/" not in seed.base_player_label(normalized_label):
            if seed.is_sub_import_label(normalized_label) and not direct_rule_player.merge_sub_into_canonical:
                identity = self.auto_identity(normalized_label)
                profile = seed.identity_profile(identity, self.player_profiles)
                payload = auto_player_payload(identity, profile)
                payload["source"] = "auto_sub_kept_separate"
                return [payload], None
            return [canonical_player_payload(direct_rule_player, "identity_map")], None

        slot_labels = seed.player_slot_labels(normalized_label)
        if len(slot_labels) > 1:
            unique_players: dict[str, dict[str, object]] = {}
            for slot_label in slot_labels:
                rule_player = self.find_rule_player(slot_label)
                if rule_player is not None:
                    payload = canonical_player_payload(rule_player, "identity_map_slot")
                else:
                    identity = self.auto_identity(slot_label)
                    profile = seed.identity_profile(identity, self.player_profiles)
                    payload = auto_player_payload(identity, profile)
                    payload["source"] = "split_shared_row_auto"
                unique_players[payload["player_key"]] = payload

            if len(unique_players) == 1:
                only_payload = next(iter(unique_players.values()))
                only_payload["source"] = "merged_slot_alias"
                return [only_payload], None

            return [
                {
                    **payload,
                    "source": "split_shared_row",
                }
                for payload in unique_players.values()
            ], None

        if matchday_number is not None:
            override_key = (
                seed.normalize_label(self.season_name),
                matchday_number,
                seed.normalize_label(normalized_label),
            )
            override = self.override_lookup.get(override_key)
            if override is not None:
                self.used_override_keys.add(override_key)
                return [self.resolve_actual_player(override.actual_player)], None

        identity = self.auto_identity(normalized_label)
        profile = seed.identity_profile(identity, self.player_profiles)
        return [auto_player_payload(identity, profile)], None


def collect_weekly_records(rows: list[list[str]], total_matchdays: int) -> list[dict[str, object]]:
    header = rows[1]
    header_map = {seed.normalize_space(column): index for index, column in enumerate(header)}

    def header_index(pattern: str) -> int:
        for text, index in header_map.items():
            if re.fullmatch(pattern, text):
                return index
        raise KeyError(pattern)

    records: list[dict[str, object]] = []
    for row in rows[2:]:
        raw_label = seed.normalize_import_label(seed.safe_cell(row, 1))
        if not raw_label or re.fullmatch(r"\(\s*sub\s*\)", raw_label, flags=re.IGNORECASE):
            continue

        for matchday_number in range(1, total_matchdays + 1):
            team_value = seed.safe_cell(row, header_index(rf"MD {matchday_number} TEAM"))
            attendance_value = seed.safe_cell(row, header_index(rf"MD\s+{matchday_number}\s+ATTENDANCE"))
            team_code = seed.TEAM_CODE_MAP.get(seed.normalize_label(team_value))
            attendance_points = seed.parse_int(attendance_value) or 0
            attended = team_code is not None or attendance_points > 0
            if not attended and team_code is None:
                continue

            records.append(
                {
                    "raw_label": raw_label,
                    "matchday_number": matchday_number,
                    "team_code": team_code,
                    "attended": attended,
                }
            )

    return records


def collect_weekly_stat_records(rows: list[list[str]], total_matchdays: int) -> list[dict[str, object]]:
    header = rows[1]
    normalized_headers = [seed.normalize_label(column) for column in header]

    def find_column_index(matchday_number: int, suffixes: tuple[str, ...]) -> int | None:
        prefix_pattern = rf"MD {matchday_number}[A-Z]* "
        for index, header_name in enumerate(normalized_headers):
            if not re.fullmatch(prefix_pattern + r".+", header_name):
                continue
            for suffix in suffixes:
                if header_name.endswith(suffix):
                    return index
        return None

    stat_columns = {
        matchday_number: {
            "goals": find_column_index(matchday_number, ("GOALS",)),
            "goal_keeps": find_column_index(matchday_number, ("GOALIE POINT", "GOALIE POINTS")),
            "clean_sheet": find_column_index(matchday_number, ("CLEAN SHEET", "CLEAN SHEETS")),
        }
        for matchday_number in range(1, total_matchdays + 1)
    }

    records: list[dict[str, object]] = []
    for row in rows[2:]:
        raw_label = seed.normalize_import_label(seed.safe_cell(row, 1))
        if not raw_label or re.fullmatch(r"\(\s*sub\s*\)", raw_label, flags=re.IGNORECASE):
            continue

        for matchday_number in range(1, total_matchdays + 1):
            columns = stat_columns[matchday_number]
            goals = seed.parse_int(seed.safe_cell(row, columns["goals"])) if columns["goals"] is not None else 0
            goal_keeps = (
                seed.parse_int(seed.safe_cell(row, columns["goal_keeps"]))
                if columns["goal_keeps"] is not None
                else 0
            )
            clean_sheet_value = (
                seed.parse_int(seed.safe_cell(row, columns["clean_sheet"]))
                if columns["clean_sheet"] is not None
                else 0
            )
            goals = goals or 0
            goal_keeps = goal_keeps or 0
            clean_sheet = (clean_sheet_value or 0) > 0

            if goals == 0 and goal_keeps == 0 and not clean_sheet:
                continue

            records.append(
                {
                    "raw_label": raw_label,
                    "matchday_number": matchday_number,
                    "goals": goals,
                    "goal_keeps": goal_keeps,
                    "clean_sheet": clean_sheet,
                    "source": "weekly_teams_fallback",
                }
            )

    return records


def collect_stat_records(rows: list[list[str]]) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for row in rows[1:]:
        matchday_label = seed.normalize_space(seed.safe_cell(row, 1))
        raw_label = seed.normalize_import_label(seed.safe_cell(row, 3))
        if not matchday_label or not raw_label:
            continue

        match = re.search(r"(\d+)$", matchday_label)
        if not match:
            continue

        records.append(
            {
                "raw_label": raw_label,
                "matchday_number": int(match.group(1)),
                "goals": seed.parse_int(seed.safe_cell(row, 4)) or 0,
                "goal_keeps": seed.parse_int(seed.safe_cell(row, 5)) or 0,
                "clean_sheet": (seed.parse_int(seed.safe_cell(row, 6)) or 0) > 0,
                "source": "player_stat",
            }
        )
    return records


def build_season_report(
    row: dict[str, str],
    rule_players: dict[str, CanonicalPlayerRule],
    alias_claims: dict[str, set[str]],
    override_lookup: dict[tuple[str, int, str], BuddyOverride],
) -> dict[str, object]:
    season_name = seed.normalize_space(row.get("season_name", ""))
    season_folder = (ROOT / seed.normalize_space(row.get("season_folder", ""))).resolve()
    workbook_name = seed.normalize_space(row.get("workbook_file", "")) or "workbook.xlsx"
    workbook_path = (season_folder / workbook_name).resolve()
    ready_for_import = normalize_bool(row.get("ready_for_import"))

    report: dict[str, object] = {
        "season_name": season_name,
        "season_folder": str(season_folder),
        "workbook_path": str(workbook_path),
        "ready_for_import": ready_for_import,
        "workbook_exists": workbook_path.exists(),
        "match_dates_sheet": None,
        "missing_sheets": [],
        "weekly_sheet": None,
        "summary": {
            "raw_assignment_rows": 0,
            "generated_assignment_rows": 0,
            "raw_stat_rows": 0,
            "generated_stat_rows": 0,
            "canonical_player_count": 0,
            "matchday_count": 0,
            "match_count": 0,
            "stat_source": None,
        },
        "issues": [],
        "unresolved_labels": [],
        "canonical_players": [],
    }

    if not workbook_path.exists():
        report["issues"].append(
            {
                "type": "missing_workbook",
                "reason": "Workbook file not found.",
                "path": str(workbook_path),
            }
        )
        return report

    workbook = seed.WorkbookReader(workbook_path)
    try:
        weekly_sheet = resolve_weekly_sheet_name(workbook)
        match_dates_sheet = resolve_match_dates_sheet_name(workbook)
        missing_sheets = [sheet_name for sheet_name in REQUIRED_SHEETS if sheet_name not in workbook.sheet_members]
        if match_dates_sheet is None:
            missing_sheets.append("MATCH_DATES or MATCH DATES")
        if weekly_sheet is None:
            missing_sheets.append("WEEKLY_TEAMS or WEEKLY_ROSTER")

        report["weekly_sheet"] = weekly_sheet
        report["match_dates_sheet"] = match_dates_sheet
        report["missing_sheets"] = missing_sheets

        if missing_sheets:
            report["issues"].append(
                {
                    "type": "missing_sheets",
                    "reason": "Workbook is missing required tabs for canonical parsing.",
                    "sheet_names": missing_sheets,
                }
            )
            return report

        match_dates = seed.parse_match_dates(workbook.read_rows(match_dates_sheet))
        weekly_rows = workbook.read_rows(weekly_sheet)
        stat_rows = workbook.read_rows("PLAYER_STAT") if "PLAYER_STAT" in workbook.sheet_members else []
        match_rows = seed.parse_match_rows(workbook.read_rows("MATCH_INPUT"))
    except Exception as error:
        report["issues"].append(
            {
                "type": "workbook_parse_error",
                "reason": str(error),
            }
        )
        return report
    finally:
        workbook.close()

    resolver = SeasonResolver(season_name, workbook_path, rule_players, alias_claims, override_lookup)
    total_matchdays = max((matchday_number for matchday_number, _ in match_dates), default=0)
    weekly_records = collect_weekly_records(weekly_rows, total_matchdays)
    if stat_rows:
        stat_records = collect_stat_records(stat_rows)
        report["summary"]["stat_source"] = "PLAYER_STAT"
    else:
        stat_records = collect_weekly_stat_records(weekly_rows, total_matchdays)
        report["summary"]["stat_source"] = "WEEKLY_TEAMS fallback"
        report["issues"].append(
            {
                "type": "missing_player_stat",
                "reason": "PLAYER_STAT tab missing, using WEEKLY_TEAMS fallback stats.",
            }
        )

    report["summary"]["raw_assignment_rows"] = sum(1 for record in weekly_records if record["team_code"])
    report["summary"]["raw_stat_rows"] = len(stat_records)
    report["summary"]["matchday_count"] = len(match_dates)
    report["summary"]["match_count"] = len(match_rows)

    season_players: dict[str, dict[str, object]] = {}
    weekly_resolution_map: dict[tuple[str, int], list[dict[str, object]]] = {}

    for record in weekly_records:
        payloads, issue = resolver.resolve_label(
            str(record["raw_label"]),
            int(record["matchday_number"]),
            "weekly_assignment",
        )
        if issue is not None:
            report["unresolved_labels"].append(issue)
            continue

        if payloads is None:
            continue

        weekly_resolution_map[
            (seed.normalize_label(str(record["raw_label"])), int(record["matchday_number"]))
        ] = payloads
        for payload in payloads:
            season_players[payload["player_key"]] = payload
        if record["team_code"]:
            report["summary"]["generated_assignment_rows"] += len(payloads)

    stat_buckets: dict[tuple[str, int], list[object]] = defaultdict(lambda: [0, 0, False])
    for record in stat_records:
        lookup_key = (
            seed.normalize_label(str(record["raw_label"])),
            int(record["matchday_number"]),
        )
        payloads = weekly_resolution_map.get(lookup_key)
        issue = None

        if payloads is None:
            payloads, issue = resolver.resolve_label(
                str(record["raw_label"]),
                int(record["matchday_number"]),
                "player_stat",
            )

        if issue is not None:
            report["unresolved_labels"].append(issue)
            continue

        if payloads is None:
            continue

        report["summary"]["generated_stat_rows"] += len(payloads)
        for payload in payloads:
            season_players[payload["player_key"]] = payload
            bucket = stat_buckets[(payload["player_key"], int(record["matchday_number"]))]
            bucket[0] = int(bucket[0]) + int(record["goals"])
            bucket[1] = int(bucket[1]) + int(record["goal_keeps"])
            bucket[2] = bool(bucket[2]) or bool(record["clean_sheet"])

    report["canonical_players"] = sorted(
        season_players.values(),
        key=lambda payload: (
            str(payload["last_name"]).lower(),
            str(payload["first_name"]).lower(),
            str(payload["display_name"]).lower(),
        ),
    )
    report["summary"]["canonical_player_count"] = len(report["canonical_players"])

    issue_counter = Counter(
        (
            issue["type"],
            issue.get("matchday_number"),
            issue.get("raw_label"),
            issue.get("source_kind"),
        )
        for issue in report["unresolved_labels"]
    )
    report["unresolved_labels"] = [
        {
            **issue,
            "count": issue_counter[
                (
                    issue["type"],
                    issue.get("matchday_number"),
                    issue.get("raw_label"),
                    issue.get("source_kind"),
                )
            ],
        }
        for issue in report["unresolved_labels"]
        if issue_counter[
            (
                issue["type"],
                issue.get("matchday_number"),
                issue.get("raw_label"),
                issue.get("source_kind"),
            )
        ]
        > 0
    ]

    seen_unresolved: set[tuple[str, int | None, str, str]] = set()
    deduped_unresolved = []
    for issue in report["unresolved_labels"]:
        dedupe_key = (
            str(issue["type"]),
            issue.get("matchday_number"),
            str(issue.get("raw_label", "")),
            str(issue.get("source_kind", "")),
        )
        if dedupe_key in seen_unresolved:
            continue
        seen_unresolved.add(dedupe_key)
        deduped_unresolved.append(issue)
    report["unresolved_labels"] = sorted(
        deduped_unresolved,
        key=lambda issue: (
            issue.get("matchday_number") or 0,
            str(issue.get("raw_label", "")),
            str(issue.get("source_kind", "")),
        ),
    )

    unused_override_keys = []
    for override_key, override in override_lookup.items():
        if seed.normalize_label(override.season_name) != seed.normalize_label(season_name):
            continue
        if override_key not in resolver.used_override_keys:
            unused_override_keys.append(
                {
                    "type": "unused_buddy_override",
                    "matchday_number": override.matchday_number,
                    "raw_label": override.raw_label,
                    "actual_player": override.actual_player,
                    "reason": "Override row did not match any workbook attendance or stat label.",
                }
            )
    report["issues"].extend(unused_override_keys)
    return report


def build_markdown(report: dict[str, object]) -> str:
    summary = report["summary"]
    lines = [
        "# Canonical Import Dry Run",
        "",
        f"- Generated at: `{report['generated_at']}`",
        f"- Ready to reseed: `{summary['ready_to_reseed']}`",
        f"- Seasons processed: `{summary['processed_seasons']}`",
        f"- Workbooks found: `{summary['workbooks_found']}` / `{summary['inventory_rows']}`",
        f"- Canonical players across processed seasons: `{summary['canonical_player_count']}`",
        f"- Raw assignment rows: `{summary['raw_assignment_rows']}`",
        f"- Generated assignment rows: `{summary['generated_assignment_rows']}`",
        f"- Raw stat rows: `{summary['raw_stat_rows']}`",
        f"- Generated stat rows: `{summary['generated_stat_rows']}`",
        f"- Ambiguous identity aliases: `{summary['ambiguous_identity_aliases']}`",
        f"- Blocking ambiguous aliases: `{summary['blocking_ambiguous_identity_aliases']}`",
        "",
        "## Season Status",
        "",
    ]

    for season in report["seasons"]:
        season_summary = season["summary"]
        lines.extend(
            [
                f"### {season['season_name']}",
                "",
                f"- Ready for import flag: `{season['ready_for_import']}`",
                f"- Workbook exists: `{season['workbook_exists']}`",
                f"- Weekly sheet: `{season['weekly_sheet']}`",
                f"- Match dates sheet: `{season['match_dates_sheet']}`",
                f"- Missing sheets: `{', '.join(season['missing_sheets']) or 'none'}`",
                f"- Stat source: `{season_summary['stat_source']}`",
                f"- Canonical players: `{season_summary['canonical_player_count']}`",
                f"- Raw assignment rows: `{season_summary['raw_assignment_rows']}`",
                f"- Generated assignment rows: `{season_summary['generated_assignment_rows']}`",
                f"- Raw stat rows: `{season_summary['raw_stat_rows']}`",
                f"- Generated stat rows: `{season_summary['generated_stat_rows']}`",
                "",
            ]
        )
        if season["issues"]:
            lines.append("Issues:")
            for issue in season["issues"]:
                lines.append(
                    f"- `{issue['type']}`: {issue.get('reason', '') or issue.get('path', '')}".rstrip()
                )
            lines.append("")
        if season["unresolved_labels"]:
            lines.append("Unresolved labels:")
            for issue in season["unresolved_labels"][:20]:
                suffix = f" (x{issue['count']})" if issue.get("count", 1) > 1 else ""
                lines.append(
                    f"- MD {issue.get('matchday_number', '?')}: `{issue.get('raw_label', '')}` -> {issue.get('reason', '')}{suffix}"
                )
            if len(season["unresolved_labels"]) > 20:
                lines.append(f"- ... and {len(season['unresolved_labels']) - 20} more")
            lines.append("")

    if report["config_issues"]["ambiguous_identity_aliases"]:
        lines.extend(
            [
                "## Config Issues",
                "",
                "Ambiguous identity aliases:",
            ]
        )
        for issue in report["config_issues"]["ambiguous_identity_aliases"][:20]:
            joined = ", ".join(issue["canonical_names"])
            expected = " (expected buddy alias)" if issue["is_expected_buddy_alias"] else ""
            lines.append(f"- `{issue['alias']}` claimed by {joined}{expected}")
        if len(report["config_issues"]["ambiguous_identity_aliases"]) > 20:
            lines.append(
                f"- ... and {len(report['config_issues']['ambiguous_identity_aliases']) - 20} more"
            )
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def build_unresolved_rows(report: dict[str, object]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for season in report["seasons"]:
        for issue in season["unresolved_labels"]:
            rows.append(
                {
                    "season_name": season["season_name"],
                    "matchday_number": issue.get("matchday_number"),
                    "raw_label": issue.get("raw_label", ""),
                    "source_kind": issue.get("source_kind", ""),
                    "count": issue.get("count", 1),
                    "candidate_players": "; ".join(issue.get("candidate_players", [])),
                    "reason": issue.get("reason", ""),
                }
            )
    return rows


def player_full_name(player: dict[str, object]) -> str:
    first_name = seed.normalize_space(str(player.get("first_name", "")))
    last_name = seed.normalize_space(str(player.get("last_name", "")))
    if not last_name or last_name.lower() in {"player", "sub"}:
        return first_name or seed.normalize_space(str(player.get("display_name", "")))
    return seed.normalize_space(f"{first_name} {last_name}")


def player_nickname(player: dict[str, object]) -> str:
    raw_nickname = player.get("nickname")
    nickname = seed.normalize_space("" if raw_nickname is None else str(raw_nickname))
    if not nickname:
        return ""
    if historical.simplified_label_key(nickname) == historical.simplified_label_key(player_full_name(player)):
        return ""
    return nickname


def build_player_review_rows(report: dict[str, object]) -> list[dict[str, object]]:
    players: dict[str, dict[str, object]] = {}
    for season in report["seasons"]:
        for player in season["canonical_players"]:
            entry = players.setdefault(
                str(player["player_key"]),
                {
                    "player_key": str(player["player_key"]),
                    "full_name": player_full_name(player),
                    "nickname": player_nickname(player),
                    "public_name": seed.normalize_space(str(player.get("display_name", ""))),
                    "first_name": seed.normalize_space(str(player.get("first_name", ""))),
                    "last_name": seed.normalize_space(str(player.get("last_name", ""))),
                    "nationality": seed.normalize_space(str(player.get("nationality", ""))),
                    "positions": "; ".join(player.get("positions", [])),
                    "status": seed.normalize_space(str(player.get("status", ""))),
                    "source": seed.normalize_space(str(player.get("source", ""))),
                    "seasons": set(),
                },
            )
            entry["seasons"].add(season["season_name"])

    rows = []
    for entry in players.values():
        rows.append(
            {
                **entry,
                "seasons": "; ".join(sorted(entry["seasons"])),
            }
        )

    return sorted(
        rows,
        key=lambda row: (
            row["full_name"].lower(),
            row["nickname"].lower(),
            row["public_name"].lower(),
        ),
    )


def build_player_list_markdown(rows: list[dict[str, object]]) -> str:
    lines = ["# Canonical Players", ""]
    for row in rows:
        if row["nickname"]:
            lines.append(f"- {row['full_name']} (nickname: {row['nickname']})")
        else:
            lines.append(f"- {row['full_name']}")
    return "\n".join(lines).rstrip() + "\n"


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    args = parse_args()
    config_root = args.config_root.expanduser().resolve()
    inventory_path = config_root / "season_inventory.csv"
    identity_map_path = config_root / "identity_map.csv"
    buddy_overrides_path = config_root / "buddy_overrides.csv"

    inventory_rows = parse_inventory_rows(inventory_path)
    if not args.include_not_ready:
        inventory_rows = [row for row in inventory_rows if normalize_bool(row.get("ready_for_import"))]

    rule_players, alias_claims, ambiguous_aliases = parse_identity_map(identity_map_path)
    overrides = parse_buddy_overrides(buddy_overrides_path)
    override_lookup = build_override_lookup(overrides)

    season_reports = [
        build_season_report(row, rule_players, alias_claims, override_lookup)
        for row in inventory_rows
    ]

    canonical_players = {
        player["player_key"]: player
        for season in season_reports
        for player in season["canonical_players"]
    }
    summary = {
        "inventory_rows": len(inventory_rows),
        "processed_seasons": len(season_reports),
        "workbooks_found": sum(1 for season in season_reports if season["workbook_exists"]),
        "canonical_player_count": len(canonical_players),
        "raw_assignment_rows": sum(
            int(season["summary"]["raw_assignment_rows"]) for season in season_reports
        ),
        "generated_assignment_rows": sum(
            int(season["summary"]["generated_assignment_rows"]) for season in season_reports
        ),
        "raw_stat_rows": sum(int(season["summary"]["raw_stat_rows"]) for season in season_reports),
        "generated_stat_rows": sum(
            int(season["summary"]["generated_stat_rows"]) for season in season_reports
        ),
        "ambiguous_identity_aliases": len(ambiguous_aliases),
        "blocking_ambiguous_identity_aliases": sum(
            1 for issue in ambiguous_aliases if not issue["is_expected_buddy_alias"]
        ),
    }
    summary["ready_to_reseed"] = (
        bool(season_reports)
        and all(season["workbook_exists"] for season in season_reports)
        and all(not season["missing_sheets"] for season in season_reports)
        and all(
            not any(issue["type"] == "workbook_parse_error" for issue in season["issues"])
            for season in season_reports
        )
        and all(not season["unresolved_labels"] for season in season_reports)
        and summary["blocking_ambiguous_identity_aliases"] == 0
    )

    report = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "config": {
            "config_root": str(config_root),
            "inventory_path": str(inventory_path),
            "identity_map_path": str(identity_map_path),
            "buddy_overrides_path": str(buddy_overrides_path),
            "include_not_ready": args.include_not_ready,
        },
        "summary": summary,
        "config_issues": {
            "ambiguous_identity_aliases": ambiguous_aliases,
        },
        "seasons": season_reports,
    }

    output_path = args.output.expanduser().resolve()
    markdown_output_path = args.markdown_output.expanduser().resolve()
    unresolved_csv_path = output_path.with_name("canonical_import_unresolved_labels.csv")
    player_review_csv_path = output_path.with_name("canonical_players_review.csv")
    player_list_markdown_path = output_path.with_name("canonical_players_list.md")
    player_review_rows = build_player_review_rows(report)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    markdown_output_path.write_text(build_markdown(report), encoding="utf-8")
    write_csv(
        unresolved_csv_path,
        build_unresolved_rows(report),
        [
            "season_name",
            "matchday_number",
            "raw_label",
            "source_kind",
            "count",
            "candidate_players",
            "reason",
        ],
    )
    write_csv(
        player_review_csv_path,
        player_review_rows,
        [
            "full_name",
            "nickname",
            "public_name",
            "first_name",
            "last_name",
            "player_key",
            "nationality",
            "positions",
            "status",
            "source",
            "seasons",
        ],
    )
    player_list_markdown_path.write_text(build_player_list_markdown(player_review_rows), encoding="utf-8")
    print(f"Wrote {output_path}")
    print(f"Wrote {markdown_output_path}")
    print(f"Wrote {unresolved_csv_path}")
    print(f"Wrote {player_review_csv_path}")
    print(f"Wrote {player_list_markdown_path}")
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if args.fail_on_issues and not summary["ready_to_reseed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
