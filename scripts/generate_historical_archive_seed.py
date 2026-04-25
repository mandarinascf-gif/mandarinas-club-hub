#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SQL_ROOT = ROOT / "sql"
DOWNLOADS = Path.home() / "Downloads"
HISTORICAL_SCRIPT_PATH = ROOT / "scripts" / "generate_historical_season_seed.py"
DEFAULT_OUTPUT_PATH = SQL_ROOT / "season_history_seed.sql"
DEFAULT_SEASONS: list[tuple[str, tuple[Path, ...]]] = [
    ("2025 Summer", (DOWNLOADS / "Copy of 2025 MANDARINAS CF CURRENT SUMMER SEASON.xlsx",)),
    ("2025 Fall", (DOWNLOADS / "2025 FALL season - mandarinas cf.xlsx",)),
    ("2025 Solstice", (DOWNLOADS / "Copy of FINISHED 2025 SOLSTICE SESON.xlsx",)),
    ("2025 Holiday", (DOWNLOADS / "2025 HOLIDAY season - mandarinas cf.xlsx",)),
    ("2026 Winter", (DOWNLOADS / "Copy of 2026 WINTER season - mandarinas cf.xlsx",)),
]


def load_historical_module():
    spec = importlib.util.spec_from_file_location("historical_seed", HISTORICAL_SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {HISTORICAL_SCRIPT_PATH}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate one merged SQL seed for all historical Mandarinas seasons."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Output .sql path. Defaults to season_history_seed.sql in the repo root.",
    )
    return parser.parse_args()


def resolve_workbook(season_name: str, candidates: tuple[Path, ...]) -> Path:
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    raise FileNotFoundError(f"Could not find a workbook for {season_name}. Checked: {', '.join(str(path) for path in candidates)}")


def extract_transaction_body(sql: str) -> str:
    before_begin, begin_marker, after_begin = sql.partition("\nbegin;\n")
    if not begin_marker:
        raise ValueError("Generated SQL is missing begin;")

    body, commit_marker, _ = after_begin.rpartition("\ncommit;")
    if not commit_marker:
        raise ValueError("Generated SQL is missing commit;")

    return body.strip()


def season_alias(season_name: str) -> str:
    slug = "".join(char.lower() if char.isalnum() else "_" for char in season_name)
    slug = "_".join(part for part in slug.split("_") if part)
    return f"season_{slug}_ready"


def build_archive_sql(historical_module, resolved_seasons: list[tuple[str, Path]]) -> str:
    all_workbooks = [workbook_path for _, workbook_path in resolved_seasons]
    season_blocks = []

    for season_name, workbook_path in resolved_seasons:
        alias_workbooks = [path for path in all_workbooks if path != workbook_path]
        season_sql = historical_module.build_sql(workbook_path, season_name, alias_workbooks)
        season_body = extract_transaction_body(season_sql)
        season_blocks.append(f"-- ---------------------------------------------------------------------------\n-- {season_name}\n-- ---------------------------------------------------------------------------\n{season_body}")

    verification_rows = ",\n  ".join(
        f"exists (select 1 from public.seasons where lower(trim(name)) = lower('{season_name}')) as {season_alias(season_name)}"
        for season_name, _ in resolved_seasons
    )

    source_rows = "\n".join(
        f"-- {index}. {season_name}: {workbook_path}"
        for index, (season_name, workbook_path) in enumerate(resolved_seasons, start=1)
    )

    return f"""-- Historical season archive seed generated from the workbook-backed season generators.
-- Run this AFTER supabase_setup.sql or supabase_setup_part1.sql + supabase_setup_part2.sql.
-- If Supabase SQL Editor shows `relation "a" does not exist`, switch the results mode
-- from `Limit 100` to `No limit`, then rerun the script.
-- Included workbooks:
{source_rows}
-- Rules applied:
-- 1. Only the historical archive seasons are replaced. Existing player rows stay in place.
-- 2. All historical imports target the current schema: seasons, season_players, matchdays,
--    matchday_matches, matchday_assignments, and matchday_player_stats.
-- 3. Historical seasons keep archive-safe tier defaults and do not overwrite richer player data
--    already present in the database.

begin;

{chr(10).join(season_blocks)}

commit;

-- Final verification query so Supabase SQL Editor has a safe SELECT result to return.
select
  {verification_rows};
"""


def main() -> None:
    args = parse_args()
    historical_module = load_historical_module()
    resolved_seasons = [
        (season_name, resolve_workbook(season_name, candidates))
        for season_name, candidates in DEFAULT_SEASONS
    ]

    output_path = args.output.expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(build_archive_sql(historical_module, resolved_seasons), encoding="utf-8")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
