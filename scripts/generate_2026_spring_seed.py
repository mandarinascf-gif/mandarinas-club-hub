#!/usr/bin/env python3
from __future__ import annotations

import csv
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET
import zipfile


ROOT = Path(__file__).resolve().parent.parent
SQL_ROOT = ROOT / "sql"
DOWNLOADS = Path.home() / "Downloads"
WORKBOOK_CANDIDATES = [
    DOWNLOADS / "current 2026 SPRING season - mandarinas cf (2).xlsx",
    DOWNLOADS / "current 2026 SPRING season - mandarinas cf (1).xlsx",
    DOWNLOADS / "current 2026 SPRING season - mandarinas cf.xlsx",
]
PLAYER_CSV_CANDIDATES = [
    DOWNLOADS / "UPDATING SOCCER APP - PLAYERS.csv",
]
OUTPUT_PATH = SQL_ROOT / "season_2026_spring_seed.sql"

SEASON_NAME = "2026 Spring"
GOALS_AS_POINTS_START = 5
ATTENDANCE_POINTS = 2
WIN_POINTS = 2
DRAW_POINTS = 1
LOSS_POINTS = 0
GOAL_KEEP_POINTS = 1
TEAM_GOAL_POINTS = 1

TEAM_CODE_MAP = {
    "BLUE": "blue",
    "MAGENTA": "magenta",
    "GREEN": "green",
    "ORANGE": "orange",
}

XML_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
BUDDY_EMOJI_RE = re.compile(r"\s*(?:👬|👭|👫|[^\s/]*🤝[^\s/]*)\s*")
ROTATION_SUB_RE = re.compile(r"^🔄\s*(?:\(([^)]+)\)|(.+))$")
LEADING_DECORATION_RE = re.compile(r"^[^0-9A-Za-zÀ-ÖØ-öø-ÿ(]+(?=[0-9A-Za-zÀ-ÖØ-öø-ÿ])")
WRAPPED_LABEL_RE = re.compile(r"^\(([^()]+)\)$")


@dataclass(frozen=True)
class PlayerIdentity:
    first_name: str
    last_name: str
    nickname: str | None
    status: str


@dataclass(frozen=True)
class PlayerProfile:
    nationality: str
    positions: tuple[str, ...]


STATUS_PRIORITY = {
    "flex_sub": 0,
    "rotation": 1,
    "core": 2,
}

PLAYER_PROFILE_ALIASES = {
    "GUSTAVO": "GUSTAVO ORTIZ",
    "LUIS MARROQUIN": "LUIS",
    "URIEL": "URIEL ORTIZ",
}

# The 2026 Spring workbook has one raw stat entry that does not match the final LEAGUE_STANDINGS tab.
# We treat the standings tab as the source of truth for season totals.
STAT_OVERRIDES = {
    ("DAVID", 6): {
        "goals": 0,
    },
}

# The 2026-04-23 Matchday 8 workbook still uses shared slash labels for a few
# rotation pairs. The league manager confirmed who actually attended that night,
# so we pin those rows to the real player instead of relying on attendance-based
# auto-resolution.
MATCHDAY_PLAYER_OVERRIDES = {
    (8, "ALEXIS / LÓPEZ"): "ALEXIS",
    (8, "EFRAÍN / FABIÁN"): "EFRAÍN",
    (8, "KEVIN / MIKE"): "MIKE",
    (8, "URIEL / GUSTAVO"): "URIEL",
}


def normalize_space(value: str) -> str:
    return " ".join((value or "").replace("\xa0", " ").split())


def normalize_label(value: str) -> str:
    return normalize_space(value).upper()


def normalize_import_label(import_label: str) -> str:
    cleaned = normalize_space(import_label)
    rotation_match = ROTATION_SUB_RE.match(cleaned)
    if rotation_match:
        cleaned = f"(Sub) {normalize_space(rotation_match.group(1) or rotation_match.group(2) or '')}"
    while not re.match(r"^\(\s*sub\s*\)", cleaned, flags=re.IGNORECASE):
        wrapped_match = WRAPPED_LABEL_RE.match(cleaned)
        if wrapped_match is None:
            break
        cleaned = normalize_space(wrapped_match.group(1))
    cleaned = LEADING_DECORATION_RE.sub("", cleaned)
    cleaned = BUDDY_EMOJI_RE.sub(" / ", cleaned)
    cleaned = re.sub(r"\s*/\s*", " / ", cleaned)
    cleaned = re.sub(r"^\(\s*sub\s*\)\s*/\s*", "(Sub) ", cleaned, flags=re.IGNORECASE)
    return normalize_space(cleaned).strip("/ ")


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char))


def simplified_label_key(value: str) -> str:
    cleaned = normalize_import_label(value)
    cleaned = cleaned.replace("’", "'")
    cleaned = re.sub(r"(?<=\w)'(?=\w)", "", cleaned)
    cleaned = cleaned.replace(".", " ")
    cleaned = strip_accents(cleaned)
    return normalize_label(cleaned)


def normalize_nationality(value: str) -> str:
    cleaned = normalize_space(value)
    if not cleaned or cleaned.upper() == "#N/A":
        return "Unknown"
    if cleaned.upper() in {"USA", "US"}:
        return "USA"
    return " ".join(part.capitalize() for part in cleaned.split())


def sql_literal(value: str | None) -> str:
    if value is None:
        return "null"
    return "'" + value.replace("'", "''") + "'"


def sql_text_array(values: tuple[str, ...] | list[str]) -> str:
    cleaned = [normalize_space(value) for value in values if normalize_space(value)]
    if not cleaned:
        return "array['MID']::text[]"
    joined = ", ".join(sql_literal(value) for value in cleaned)
    return f"array[{joined}]::text[]"


def identity_profile(identity: PlayerIdentity, profile_map: dict[str, PlayerProfile]) -> PlayerProfile:
    lookup_labels = [
        identity.nickname or "",
        f"{identity.first_name} {identity.last_name}",
        identity.first_name,
    ]

    for label in lookup_labels:
        for key in (normalize_label(label), simplified_label_key(label)):
            if not key:
                continue
            if key in profile_map:
                return profile_map[key]
            aliased_key = PLAYER_PROFILE_ALIASES.get(key)
            if aliased_key:
                for alias_lookup in (normalize_label(aliased_key), simplified_label_key(aliased_key)):
                    if alias_lookup in profile_map:
                        return profile_map[alias_lookup]

    return PlayerProfile("Unknown", ("MID",))


def pretty_token(token: str) -> str:
    token = normalize_space(token)
    if not token:
        return token
    if token.startswith("(") and token.endswith(")"):
        return token
    return token.title()


def base_player_label(import_label: str) -> str:
    cleaned = normalize_import_label(import_label)
    return normalize_space(re.sub(r"^\(\s*sub\s*\)\s*", "", cleaned, count=1, flags=re.IGNORECASE))


def is_sub_import_label(import_label: str) -> bool:
    return bool(re.match(r"^\(\s*sub\s*\)\s*", normalize_import_label(import_label), flags=re.IGNORECASE))


def split_player_labels(import_label: str) -> list[str]:
    base_label = base_player_label(import_label)
    if "/" in base_label:
        return [normalize_label(part) for part in re.split(r"\s*/\s*", base_label) if normalize_space(part)]
    return [normalize_label(base_label)] if base_label else []


def player_slot_labels(import_label: str, protected_sub_labels: set[str] | None = None) -> list[str]:
    protected_sub_labels = protected_sub_labels or set()
    base_label = base_player_label(import_label)
    if not base_label:
        return []

    if is_sub_import_label(import_label) and "/" not in base_label:
        return [normalize_import_label(import_label)]

    return split_player_labels(import_label)


def status_from_import_label(import_label: str) -> str:
    clean_label = normalize_import_label(import_label)
    base_label = base_player_label(clean_label)
    if is_sub_import_label(clean_label):
        return "flex_sub"
    if "/" in base_label:
        return "rotation"
    return "core"


def merge_status(current_status: str | None, next_status: str) -> str:
    if current_status is None:
        return next_status
    if STATUS_PRIORITY[next_status] > STATUS_PRIORITY[current_status]:
        return next_status
    return current_status


def canonical_identity(import_label: str) -> PlayerIdentity:
    clean_label = normalize_import_label(import_label)
    base_label = base_player_label(clean_label)
    status = status_from_import_label(clean_label)

    if not base_label:
        base_label = "Imported Player"

    if is_sub_import_label(clean_label) and "/" not in base_label:
        first_name = pretty_token(base_label) or "Sub"
        last_name = "Sub"
    elif "/" in base_label:
        first_raw, last_raw = [normalize_space(part) for part in re.split(r"\s*/\s*", base_label, maxsplit=1)]
        first_name = pretty_token(first_raw) or "Rotation"
        last_name = pretty_token(last_raw) or "Player"
    else:
        parts = base_label.split()
        if len(parts) == 1:
            first_name = pretty_token(parts[0])
            last_name = "Player"
        else:
            first_name = pretty_token(" ".join(parts[:-1]))
            last_name = pretty_token(parts[-1])

    if len(first_name.strip()) < 2:
        first_name = "Player"

    if len(last_name.strip()) < 2:
        last_name = "Player"

    nickname = clean_label if is_sub_import_label(clean_label) else base_label
    return PlayerIdentity(first_name[:40], last_name[:40], nickname[:50], status)


def safe_cell(row: list[str], index: int) -> str:
    return row[index] if 0 <= index < len(row) else ""


def parse_int(value: str | None) -> int | None:
    text = normalize_space(str(value or ""))
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def excel_serial_to_iso_date(value: str) -> str:
    serial = float(value)
    date_value = datetime(1899, 12, 30) + timedelta(days=serial)
    return date_value.date().isoformat()


def resolve_workbook_path() -> Path:
    if len(sys.argv) > 1:
        candidate = Path(sys.argv[1]).expanduser().resolve()
        if not candidate.exists():
            raise FileNotFoundError(candidate)
        return candidate

    for candidate in WORKBOOK_CANDIDATES:
        if candidate.exists():
            return candidate

    raise FileNotFoundError(
        "No default workbook was found. Pass the .xlsx path explicitly to scripts/generate_2026_spring_seed.py."
    )


def resolve_player_csv_path() -> Path | None:
    for candidate in PLAYER_CSV_CANDIDATES:
        if candidate.exists():
            return candidate
    return None


def parse_player_profiles(csv_path: Path | None) -> dict[str, PlayerProfile]:
    if not csv_path or not csv_path.exists():
        return {}

    profile_map: dict[str, PlayerProfile] = {}

    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            player_name = normalize_space(row.get("player_name", ""))
            if not player_name:
                continue

            nationality = normalize_nationality(row.get("nationality", ""))

            positions = tuple(
                normalize_space(row.get(column, ""))
                for column in ("first_position", "second_position", "third_position")
                if normalize_space(row.get(column, "")) and normalize_space(row.get(column, "")).upper() != "#N/A"
            ) or ("MID",)

            profile = PlayerProfile(nationality, positions)
            profile_map[normalize_label(player_name)] = profile
            profile_map.setdefault(simplified_label_key(player_name), profile)

    return profile_map


def column_index_from_ref(cell_ref: str) -> int:
    letters = "".join(char for char in cell_ref if char.isalpha())
    value = 0
    for char in letters:
        value = (value * 26) + (ord(char.upper()) - 64)
    return value


class WorkbookReader:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.archive = zipfile.ZipFile(path)
        self.shared_strings = self._load_shared_strings()
        self.sheet_members = self._load_sheet_members()

    def close(self) -> None:
        self.archive.close()

    def _load_shared_strings(self) -> list[str]:
        if "xl/sharedStrings.xml" not in self.archive.namelist():
            return []
        root = ET.fromstring(self.archive.read("xl/sharedStrings.xml"))
        values: list[str] = []
        for shared_item in root.findall(f"{XML_NS}si"):
            values.append("".join(text.text or "" for text in shared_item.iter(f"{XML_NS}t")))
        return values

    def _load_sheet_members(self) -> dict[str, str]:
        workbook_root = ET.fromstring(self.archive.read("xl/workbook.xml"))
        relationships_root = ET.fromstring(self.archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {
            relationship.attrib["Id"]: relationship.attrib["Target"] for relationship in relationships_root
        }
        members: dict[str, str] = {}
        for sheet in workbook_root.find(f"{XML_NS}sheets"):
            name = sheet.attrib["name"]
            relationship_id = sheet.attrib[f"{REL_NS}id"]
            members[name] = "xl/" + relationship_map[relationship_id]
        return members

    def read_rows(self, sheet_name: str) -> list[list[str]]:
        member = self.sheet_members[sheet_name]
        root = ET.fromstring(self.archive.read(member))
        rows: list[list[str]] = []

        for row in root.iter(f"{XML_NS}row"):
            row_values: dict[int, str] = {}
            max_column = 0

            for cell in row.findall(f"{XML_NS}c"):
                cell_ref = cell.attrib.get("r", "")
                column_index = column_index_from_ref(cell_ref)
                max_column = max(max_column, column_index)

                cell_type = cell.attrib.get("t")
                value_node = cell.find(f"{XML_NS}v")
                inline_node = cell.find(f"{XML_NS}is")
                value = ""

                if cell_type == "s" and value_node is not None and value_node.text is not None:
                    shared_index = int(value_node.text)
                    value = self.shared_strings[shared_index] if 0 <= shared_index < len(self.shared_strings) else ""
                elif cell_type == "inlineStr" and inline_node is not None:
                    value = "".join(text.text or "" for text in inline_node.iter(f"{XML_NS}t"))
                elif value_node is not None and value_node.text is not None:
                    value = value_node.text

                row_values[column_index] = value

            if row_values:
                rows.append([row_values.get(index, "") for index in range(1, max_column + 1)])

        return rows


def parse_match_dates(rows: list[list[str]]) -> list[tuple[int, str]]:
    dates: list[tuple[int, str]] = []
    for row in rows:
        raw_date = safe_cell(row, 0)
        raw_label = normalize_space(safe_cell(row, 1))
        if not raw_date or not raw_label.startswith("MATCH DAY"):
            continue

        match = re.search(r"(\d+)$", raw_label)
        if not match:
            continue

        dates.append((int(match.group(1)), excel_serial_to_iso_date(raw_date)))

    return sorted(dates, key=lambda item: item[0])


def resolve_target_label(
    import_label: str,
    matchday_number: int,
    assigned_days_by_player: dict[str, int],
    active_raw_labels_by_matchday: dict[int, set[str]],
    protected_sub_labels: set[str] | None = None,
) -> str | None:
    manual_override = MATCHDAY_PLAYER_OVERRIDES.get((matchday_number, normalize_import_label(import_label)))
    if manual_override:
        return normalize_label(manual_override)

    options = player_slot_labels(import_label, protected_sub_labels)
    if not options:
        return None

    target_label = options[0]
    if len(options) == 1:
        return target_label

    active_labels = active_raw_labels_by_matchday.get(matchday_number, set())
    sub_active = [
        option for option in options if normalize_label(f"(Sub) {option}") in active_labels
    ]

    if len(sub_active) == 1:
        other_options = [option for option in options if option != sub_active[0]]
        return other_options[0] if other_options else options[0]

    return sorted(options, key=lambda option: (assigned_days_by_player[option], options.index(option)))[0]


def parse_weekly_teams(
    rows: list[list[str]],
    total_matchdays: int,
) -> tuple[
    dict[str, PlayerIdentity],
    list[tuple[str, int, str]],
    list[tuple[str, int, bool]],
    dict[tuple[str, int], str],
]:
    header = rows[1]
    header_map = {normalize_space(column): index for index, column in enumerate(header)}

    def header_index(pattern: str) -> int:
        for text, index in header_map.items():
            if re.fullmatch(pattern, text):
                return index
        raise KeyError(pattern)

    player_statuses: dict[str, str] = {}
    raw_attendance_records: list[tuple[str, int, str | None, bool]] = []
    active_raw_labels_by_matchday: dict[int, set[str]] = defaultdict(set)
    starter_labels: set[str] = set()
    sub_labels: set[str] = set()

    for row in rows[2:]:
        import_label = normalize_import_label(safe_cell(row, 1))
        if not import_label or re.fullmatch(r"\(\s*sub\s*\)", import_label, flags=re.IGNORECASE):
            continue

        base_label = normalize_label(base_player_label(import_label))
        if not base_label or "/" in base_label:
            continue

        if is_sub_import_label(import_label):
            sub_labels.add(base_label)
        else:
            starter_labels.add(base_label)

    protected_sub_labels = starter_labels & sub_labels

    for row in rows[2:]:
        import_label = normalize_import_label(safe_cell(row, 1))
        if not import_label or re.fullmatch(r"\(\s*sub\s*\)", import_label, flags=re.IGNORECASE):
            continue

        for player_label in player_slot_labels(import_label, protected_sub_labels):
            player_statuses[player_label] = merge_status(
                player_statuses.get(player_label),
                status_from_import_label(import_label),
            )

        for matchday_number in range(1, total_matchdays + 1):
            team_value = safe_cell(row, header_index(rf"MD {matchday_number} TEAM"))
            attendance_value = safe_cell(row, header_index(rf"MD\s+{matchday_number}\s+ATTENDANCE"))

            team_code = TEAM_CODE_MAP.get(normalize_label(team_value))
            attendance_points = parse_int(attendance_value) or 0
            attended = team_code is not None or attendance_points > 0

            if attended or team_code:
                raw_attendance_records.append((import_label, matchday_number, team_code, attended))
                active_raw_labels_by_matchday[matchday_number].add(normalize_label(import_label))

    player_map: dict[str, PlayerIdentity] = {}
    for player_label, status in sorted(player_statuses.items()):
        identity = canonical_identity(player_label)
        player_map[player_label] = PlayerIdentity(
            identity.first_name,
            identity.last_name,
            pretty_token(player_label)[:50],
            status,
        )

    assignments: list[tuple[str, int, str]] = []
    attendance_rows: list[tuple[str, int, bool]] = []
    assigned_days_by_player: dict[str, int] = defaultdict(int)
    resolved_map: dict[tuple[str, int], str] = {}

    for import_label, matchday_number, team_code, attended in sorted(
        raw_attendance_records,
        key=lambda item: (item[1], item[0]),
    ):
        target_label = resolve_target_label(
            import_label,
            matchday_number,
            assigned_days_by_player,
            active_raw_labels_by_matchday,
            protected_sub_labels,
        )
        if not target_label:
            continue

        resolved_map[(normalize_label(import_label), matchday_number)] = target_label

        if team_code:
            assignments.append((target_label, matchday_number, team_code))

        attendance_rows.append((target_label, matchday_number, attended))
        if attended:
            assigned_days_by_player[target_label] += 1

    return player_map, assignments, attendance_rows, resolved_map


def parse_player_stats(
    rows: list[list[str]],
    resolved_map: dict[tuple[str, int], str],
    protected_sub_labels: set[str] | None = None,
) -> dict[tuple[str, int], tuple[int, int, bool]]:
    stats_by_key: dict[tuple[str, int], list[object]] = defaultdict(lambda: [0, 0, False])

    for row in rows[1:]:
        matchday_label = normalize_space(safe_cell(row, 1))
        import_label = normalize_import_label(safe_cell(row, 3))
        if not matchday_label or not import_label:
            continue

        match = re.search(r"(\d+)$", matchday_label)
        if not match:
            continue

        matchday_number = int(match.group(1))
        target_label = resolved_map.get((normalize_label(import_label), matchday_number))

        if target_label is None:
            options = player_slot_labels(import_label, protected_sub_labels)
            if not options:
                continue
            target_label = options[0]

        goals = parse_int(safe_cell(row, 4)) or 0
        goal_keeps = parse_int(safe_cell(row, 5)) or 0
        clean_sheet = (parse_int(safe_cell(row, 6)) or 0) > 0

        bucket = stats_by_key[(target_label, matchday_number)]
        bucket[0] = int(bucket[0]) + goals
        bucket[1] = int(bucket[1]) + goal_keeps
        bucket[2] = bool(bucket[2]) or clean_sheet

    normalized = {
        key: (int(values[0]), int(values[1]), bool(values[2]))
        for key, values in stats_by_key.items()
    }

    for override_key, override_values in STAT_OVERRIDES.items():
        goals, goal_keeps, clean_sheet = normalized.get(override_key, (0, 0, False))
        normalized[override_key] = (
            int(override_values.get("goals", goals)),
            int(override_values.get("goal_keeps", goal_keeps)),
            bool(override_values.get("clean_sheet", clean_sheet)),
        )

    return normalized



def parse_match_rows(rows: list[list[str]]) -> list[tuple[int, int, int, str | None, str | None, int | None, int | None]]:
    match_rows: list[tuple[int, int, int, str | None, str | None, int | None, int | None]] = []
    round_map = {
        1: (1, 1),
        2: (1, 2),
        3: (2, 1),
        4: (2, 2),
    }

    for row in rows[1:]:
        label = normalize_space(safe_cell(row, 1))
        if not label.startswith("MATCH DAY"):
            continue

        day_match = re.search(r"(\d+)$", label)
        if not day_match:
            continue

        match_number = parse_int(safe_cell(row, 2))
        if match_number not in round_map:
            continue

        round_number, match_order = round_map[match_number]
        home_team = TEAM_CODE_MAP.get(normalize_label(safe_cell(row, 5)))
        away_team = TEAM_CODE_MAP.get(normalize_label(safe_cell(row, 9)))
        home_score = parse_int(safe_cell(row, 6))
        away_score = parse_int(safe_cell(row, 8))

        match_rows.append(
            (
                int(day_match.group(1)),
                round_number,
                match_order,
                home_team,
                away_team,
                home_score,
                away_score,
            )
        )

    return sorted(match_rows, key=lambda item: (item[0], item[1], item[2]))


def values_block(rows: list[str], columns_sql: str) -> str:
    column_count = len([column.strip() for column in columns_sql.split(",")])
    if rows:
        return "(\n  select *\n  from (\n    values\n      " + ",\n      ".join(rows) + f"\n  ) as seed({columns_sql})\n)"
    null_row = ", ".join("null" for _ in range(column_count))
    return f"(\n  select *\n  from (\n    values ({null_row})\n  ) as seed({columns_sql})\n  where false\n)"


def build_sql() -> str:
    workbook_path = resolve_workbook_path()
    player_csv_path = resolve_player_csv_path()
    player_profiles = parse_player_profiles(player_csv_path)
    workbook = WorkbookReader(workbook_path)
    try:
        match_dates = parse_match_dates(workbook.read_rows("MATCH_DATES"))
        total_matchdays = max((matchday_number for matchday_number, _ in match_dates), default=8)
        goals_as_points_matchdays = {
            matchday_number for matchday_number, _ in match_dates if matchday_number >= GOALS_AS_POINTS_START
        }

        player_map, assignments, attendance_rows, resolved_map = parse_weekly_teams(
            workbook.read_rows("WEEKLY_TEAMS"),
            total_matchdays,
        )
        stats_by_key = parse_player_stats(workbook.read_rows("PLAYER_STAT"), resolved_map)
        match_rows = parse_match_rows(workbook.read_rows("MATCH_INPUT"))
    finally:
        workbook.close()

    attendance_map = {(label, matchday_number): attended for label, matchday_number, attended in attendance_rows}
    stat_keys = set(attendance_map) | set(stats_by_key)

    stat_values_rows = []
    for import_label, matchday_number in sorted(stat_keys, key=lambda item: (item[1], item[0])):
        goals, goal_keeps, clean_sheet = stats_by_key.get((import_label, matchday_number), (0, 0, False))
        attended = attendance_map.get((import_label, matchday_number), True if (import_label, matchday_number) in stats_by_key else False)
        stat_values_rows.append(
            (
                import_label,
                matchday_number,
                attended,
                "in" if attended else "out",
                goals,
                goal_keeps,
                clean_sheet,
            )
        )

    sorted_aliases = sorted(
        player_map.items(),
        key=lambda item: (item[0].lower(), item[1].last_name.lower(), item[1].first_name.lower()),
    )

    seen_identities: dict[tuple[str, str], str] = {}
    deduplicated_aliases: list[tuple[str, PlayerIdentity]] = []
    removed_aliases: dict[str, str] = {}
    for import_label, identity in sorted_aliases:
        identity_key = (identity.first_name, identity.last_name)
        if identity_key not in seen_identities:
            seen_identities[identity_key] = import_label
            deduplicated_aliases.append((import_label, identity))
        else:
            removed_aliases[import_label] = seen_identities[identity_key]

    sorted_players = sorted(
        (identity for _, identity in deduplicated_aliases),
        key=lambda identity: (identity.last_name.lower(), identity.first_name.lower(), (identity.nickname or "").lower()),
    )
    core_spots = sum(1 for identity in sorted_players if identity.status == "core")
    rotation_spots = sum(1 for identity in sorted_players if identity.status == "rotation")

    remapped_assignments = []
    seen_assignment_keys: set[tuple[str, int]] = set()
    for import_label, matchday_number, team_code in assignments:
        canonical_label = removed_aliases.get(import_label, import_label)
        assignment_key = (canonical_label, matchday_number)
        if assignment_key not in seen_assignment_keys:
            remapped_assignments.append((canonical_label, matchday_number, team_code))
            seen_assignment_keys.add(assignment_key)

    remapped_stats = []
    seen_stat_keys: set[tuple[str, int]] = set()
    for import_label, matchday_number, attended, attendance_status, goals, goal_keeps, clean_sheet in stat_values_rows:
        canonical_label = removed_aliases.get(import_label, import_label)
        stat_key = (canonical_label, matchday_number)
        if stat_key not in seen_stat_keys:
            remapped_stats.append((canonical_label, matchday_number, attended, attendance_status, goals, goal_keeps, clean_sheet))
            seen_stat_keys.add(stat_key)

    player_value_rows = [
        f"({sql_literal(identity.first_name)}, {sql_literal(identity.last_name)}, {sql_literal(identity.nickname)}, "
        f"{sql_literal(identity_profile(identity, player_profiles).nationality)}, "
        f"{sql_text_array(identity_profile(identity, player_profiles).positions)}, {sql_literal(identity.status)}, {sql_literal(identity.status)})"
        for identity in sorted_players
    ]

    alias_value_rows = [
        f"({sql_literal(import_label)}, {sql_literal(identity.first_name)}, {sql_literal(identity.last_name)})"
        for import_label, identity in deduplicated_aliases
    ]

    matchday_value_rows = [
        f"({matchday_number}, timestamptz {sql_literal(date_value + ' 12:00:00 America/Los_Angeles')}, "
        f"{'true' if matchday_number in goals_as_points_matchdays else 'false'})"
        for matchday_number, date_value in match_dates
    ]

    match_value_rows = [
        f"({matchday_number}, {round_number}, {match_order}, {sql_literal(home_team)}, {sql_literal(away_team)}, "
        f"{home_score if home_score is not None else 'null'}, {away_score if away_score is not None else 'null'})"
        for matchday_number, round_number, match_order, home_team, away_team, home_score, away_score in match_rows
    ]

    assignment_value_rows = [
        f"({sql_literal(import_label)}, {matchday_number}, {sql_literal(team_code)})"
        for import_label, matchday_number, team_code in remapped_assignments
    ]

    stat_value_rows = [
        f"({sql_literal(import_label)}, {matchday_number}, {'true' if attended else 'false'}, "
        f"{sql_literal(attendance_status)}, {goals}, {goal_keeps}, {'true' if clean_sheet else 'false'})"
        for import_label, matchday_number, attended, attendance_status, goals, goal_keeps, clean_sheet in remapped_stats
    ]

    season_player_value_rows = [
        f"({sql_literal(import_label)}, {sql_literal(identity.status)})"
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

    return f"""-- Seed generated from the 2026 Spring source workbook.
-- Run this AFTER supabase_setup.sql or supabase_setup_part1.sql + supabase_setup_part2.sql.
-- If Supabase SQL Editor shows `relation "a" does not exist`, switch the results mode
-- from `Limit 100` to `No limit`, then rerun the script.
-- Source tabs used:
-- 1. MATCH_DATES
-- 2. WEEKLY_TEAMS
-- 3. MATCH_INPUT
-- 4. PLAYER_STAT
-- 5. UPDATING SOCCER APP - PLAYERS.csv
-- Rules applied:
-- 1. The season is stored as "{SEASON_NAME}".
-- 2. Kickoff times default to 12:00 PM America/Los_Angeles and can be edited later in the UI.
-- 3. Names with "/" are treated as buddy pairs and seeded as rotation players.
-- 4. Labels starting with "(Sub)" are treated as flex/sub players.
-- 5. Blank scores mean the match has not been played yet, so scores stay null.
-- 6. Running this seed replaces only the "{SEASON_NAME}" season data.
-- 7. Matching player rows are refreshed in place, and missing players are inserted.

begin;

delete from public.seasons
where lower(trim(name)) = lower({sql_literal(SEASON_NAME)});

with player_seed as {player_values_sql}
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
  {sql_literal(SEASON_NAME)},
  {total_matchdays},
  {core_spots},
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
  where lower(trim(name)) = lower({sql_literal(SEASON_NAME)})
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
  where lower(trim(name)) = lower({sql_literal(SEASON_NAME)})
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
  where lower(trim(name)) = lower({sql_literal(SEASON_NAME)})
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
  where lower(trim(name)) = lower({sql_literal(SEASON_NAME)})
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
  where lower(trim(name)) = lower({sql_literal(SEASON_NAME)})
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
  'Seeded from the latest 2026 Spring workbook.',
  'Recalculate after reviewing availability, late cancels, and no-shows.',
  true
from season_row
join season_player_seed
  on true
join player_lookup
  on player_lookup.import_label = season_player_seed.import_label;

commit;

-- Final verification query so Supabase SQL Editor has a safe SELECT result to return.
select
  exists (select 1 from public.seasons where lower(trim(name)) = lower({sql_literal(SEASON_NAME)})) as season_2026_spring_ready,
  exists (
    select 1
    from public.matchdays md
    join public.seasons s on s.id = md.season_id
    where lower(trim(s.name)) = lower({sql_literal(SEASON_NAME)})
  ) as season_2026_spring_matchdays_ready,
  exists (
    select 1
    from public.season_players sp
    join public.seasons s on s.id = sp.season_id
    where lower(trim(s.name)) = lower({sql_literal(SEASON_NAME)})
  ) as season_2026_spring_roster_ready;
"""


def main() -> None:
    workbook_path = resolve_workbook_path()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(build_sql(), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} from {workbook_path}")


if __name__ == "__main__":
    main()
