#!/usr/bin/env python3
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = ROOT / "data"
RESEED_CONFIG_ROOT = DATA_ROOT / "reseed_config"
RESEED_SOURCE_ROOT = DATA_ROOT / "reseed_source"
RESEED_REPORT_ROOT = DATA_ROOT / "reseed_reports"
SQL_ROOT = ROOT / "sql"


def normalize_space(value: object) -> str:
    return " ".join(str(value or "").replace("\xa0", " ").split())


def normalize_season_name(value: object) -> str:
    return normalize_space(value).casefold()


def relative_to_root(path: Path | str) -> str:
    candidate = Path(path)
    resolved = candidate.resolve() if candidate.is_absolute() else (ROOT / candidate).resolve()
    try:
        return resolved.relative_to(ROOT).as_posix()
    except ValueError:
        return str(resolved)


@dataclass(frozen=True)
class SeasonInventoryEntry:
    season_name: str
    season_folder: str
    workbook_file: str
    ready_for_import: bool

    @property
    def season_folder_path(self) -> Path:
        return (ROOT / self.season_folder).resolve()

    @property
    def workbook_path(self) -> Path:
        return (self.season_folder_path / self.workbook_file).resolve()


def resolve_inventory_row_season_folder(row: Mapping[str, object]) -> Path:
    season_folder = normalize_space(row.get("season_folder", ""))
    if not season_folder:
        raise ValueError("Inventory row is missing season_folder.")
    return (ROOT / season_folder).resolve()


def resolve_inventory_row_workbook(row: Mapping[str, object]) -> Path:
    workbook_file = normalize_space(row.get("workbook_file", "")) or "workbook.xlsx"
    return (resolve_inventory_row_season_folder(row) / workbook_file).resolve()


def _normalize_bool(value: object) -> bool:
    return normalize_space(value).upper() in {"1", "TRUE", "YES", "Y"}


def read_season_inventory(config_root: Path = RESEED_CONFIG_ROOT) -> list[SeasonInventoryEntry]:
    inventory_path = config_root / "season_inventory.csv"
    rows: list[SeasonInventoryEntry] = []
    if not inventory_path.exists():
        return rows

    with inventory_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            season_name = normalize_space(row.get("season_name", ""))
            if not season_name:
                continue

            rows.append(
                SeasonInventoryEntry(
                    season_name=season_name,
                    season_folder=normalize_space(row.get("season_folder", "")),
                    workbook_file=normalize_space(row.get("workbook_file", "")) or "workbook.xlsx",
                    ready_for_import=_normalize_bool(row.get("ready_for_import")),
                )
            )

    return rows


def resolve_season_inventory_entry(
    season_name: str,
    config_root: Path = RESEED_CONFIG_ROOT,
) -> SeasonInventoryEntry:
    normalized_target = normalize_season_name(season_name)
    entries = read_season_inventory(config_root)
    for entry in entries:
        if normalize_season_name(entry.season_name) == normalized_target:
            return entry

    known_seasons = ", ".join(entry.season_name for entry in entries) or "(none)"
    raise FileNotFoundError(
        f"Season {season_name!r} was not found in {relative_to_root(config_root / 'season_inventory.csv')}. "
        f"Known seasons: {known_seasons}"
    )


def resolve_season_workbook(
    season_name: str,
    config_root: Path = RESEED_CONFIG_ROOT,
) -> Path:
    return resolve_season_inventory_entry(season_name, config_root).workbook_path
