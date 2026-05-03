#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from reseed_paths import resolve_season_workbook

ROOT = Path(__file__).resolve().parent.parent
SEED_SCRIPT_PATH = ROOT / "scripts" / "generate_2026_spring_seed.py"
DEFAULT_SUPABASE_URL = "https://kreryiryoorlmiqqhpcj.supabase.co"
DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aJ-TKJ-t1vr4dCit4s3-lQ_ZcYLuCO-"
DEFAULT_SEASONS = ("2025 Winter", "2025 Spring")


def load_seed_module():
    spec = importlib.util.spec_from_file_location("historical_match_seed", SEED_SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {SEED_SCRIPT_PATH}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


seed = load_seed_module()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill historical matchday_matches rows from the canonical workbook sources."
    )
    parser.add_argument(
        "--season",
        action="append",
        dest="seasons",
        help="Season name to repair. Defaults to the known missing historical seasons.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be repaired without writing to Supabase.",
    )
    parser.add_argument(
        "--supabase-url",
        default=DEFAULT_SUPABASE_URL,
        help="Supabase REST base URL.",
    )
    parser.add_argument(
        "--publishable-key",
        default=DEFAULT_SUPABASE_PUBLISHABLE_KEY,
        help="Supabase publishable key.",
    )
    return parser.parse_args()


def request_json(
    method: str,
    base_url: str,
    path: str,
    publishable_key: str,
    payload: list[dict[str, object]] | None = None,
    extra_headers: dict[str, str] | None = None,
):
    data = None
    headers = {
        "apikey": publishable_key,
        "Authorization": f"Bearer {publishable_key}",
        "Accept": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/rest/v1/{path}",
        data=data,
        headers=headers,
        method=method,
    )

    try:
        ssl_context = ssl.create_default_context()
    except Exception:
        ssl_context = ssl._create_unverified_context()

    try:
        response_handle = urllib.request.urlopen(request, context=ssl_context)
    except urllib.error.URLError as error:
        if isinstance(error.reason, ssl.SSLCertVerificationError):
            response_handle = urllib.request.urlopen(
                request,
                context=ssl._create_unverified_context(),
            )
        else:
            raise

    with response_handle as response:
        body = response.read().decode("utf-8").strip()
        if not body:
            return []
        return json.loads(body)


def workbook_match_rows(workbook_path: Path):
    workbook = seed.WorkbookReader(workbook_path)
    try:
        return seed.parse_match_rows(workbook.read_rows("MATCH_INPUT"))
    finally:
        workbook.close()


def fetch_single_row(base_url: str, path: str, publishable_key: str):
    rows = request_json("GET", base_url, path, publishable_key)
    if len(rows) != 1:
        raise RuntimeError(f"Expected exactly one row for {path}, found {len(rows)}")
    return rows[0]


def main() -> None:
    args = parse_args()
    target_seasons = args.seasons or list(DEFAULT_SEASONS)

    for season_name in target_seasons:
        workbook_path = resolve_season_workbook(season_name)
        if not workbook_path.exists():
            raise FileNotFoundError(f"Workbook not found for {season_name}: {workbook_path}")

        season_path = "seasons?select=id,name&name=eq." + urllib.parse.quote(season_name)
        season_row = fetch_single_row(args.supabase_url, season_path, args.publishable_key)
        season_id = int(season_row["id"])

        matchdays = request_json(
            "GET",
            args.supabase_url,
            f"matchdays?select=id,matchday_number&season_id=eq.{season_id}&order=matchday_number.asc",
            args.publishable_key,
        )
        matchday_lookup = {int(row["matchday_number"]): int(row["id"]) for row in matchdays}
        workbook_rows = workbook_match_rows(workbook_path)
        payload = []
        for matchday_number, round_number, match_order, home_team, away_team, home_score, away_score in workbook_rows:
            matchday_id = matchday_lookup.get(int(matchday_number))
            if matchday_id is None:
                raise RuntimeError(
                    f"Missing matchday {matchday_number} in Supabase for {season_name}. Cannot repair match rows."
                )
            payload.append(
                {
                    "matchday_id": matchday_id,
                    "round_number": int(round_number),
                    "match_order": int(match_order),
                    "home_team_code": home_team,
                    "away_team_code": away_team,
                    "home_score": home_score,
                    "away_score": away_score,
                }
            )

        existing_rows = request_json(
            "GET",
            args.supabase_url,
            "matchday_matches?select=matchday_id,round_number,match_order&matchday_id=in.("
            + ",".join(str(matchday_lookup[number]) for number in sorted(matchday_lookup))
            + ")",
            args.publishable_key,
        )

        print(
            f"{season_name}: workbook_rows={len(payload)} existing_rows={len(existing_rows)}"
            + (" [dry-run]" if args.dry_run else "")
        )

        if args.dry_run:
            continue

        request_json(
            "POST",
            args.supabase_url,
            "matchday_matches?on_conflict=matchday_id,round_number,match_order",
            args.publishable_key,
            payload=payload,
            extra_headers={
                "Prefer": "resolution=merge-duplicates,return=representation",
            },
        )

    print("Historical match-row repair complete.")


if __name__ == "__main__":
    main()
