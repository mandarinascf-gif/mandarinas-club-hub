#!/usr/bin/env python3

import csv
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ALIAS_EQUIVALENTS = {
    "efrain": {"efra", "efrain"},
    "efra": {"efra", "efrain"},
    "gabo": {"gabo", "gabriel"},
    "gabriel": {"gabo", "gabriel"},
    "nizama": {"nizama", "victor nizama", "victor"},
    "pablo": {"pablo", "pablo crespin", "juan pablo"},
    "nunez": {"nunez", "jose nunez", "jose"},
    "jhony": {"jhony", "jhony s", "jhony sanchez"},
    "jhony s": {"jhony", "jhony s", "jhony sanchez"},
    "joseph m": {"joseph m", "joseph", "joseph muro"},
    "saul": {"saul", "saul arreaga"},
}


def normalize(value: str) -> str:
    text = (value or "").strip().lower()
    text = "".join(
        char for char in unicodedata.normalize("NFKD", text) if not unicodedata.combining(char)
    )
    text = re.sub(r"[^a-z0-9]+", " ", text).strip()
    return text


def display_name(row: dict) -> str:
    return " ".join(part for part in [row.get("first_name", "").strip(), row.get("last_name", "").strip()] if part)


def parse_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def is_generic_last_name(row: dict) -> bool:
    return normalize(row.get("last_name", "")) in {"player", "sub"}


def sort_key_for_keeper(row: dict) -> tuple:
    return (
        is_generic_last_name(row),
        normalize(row.get("last_name", "")) == "player",
        int(row.get("id") or "0"),
    )


def choose_group_key(row: dict) -> str:
    nickname = normalize(row.get("nickname", ""))
    if nickname:
        return nickname
    if normalize(row.get("last_name", "")) == "player":
        return normalize(row.get("first_name", ""))
    return normalize(display_name(row))


def build_groups(rows: list[dict]) -> dict[str, list[dict]]:
    groups = defaultdict(list)
    for row in rows:
        group_key = choose_group_key(row)
        if group_key:
            groups[group_key].append(row)
    return groups


def reason_for_pair(keeper: dict, duplicate: dict, group_key: str) -> tuple[str, str]:
    keeper_generic = is_generic_last_name(keeper)
    duplicate_generic = is_generic_last_name(duplicate)
    keeper_nickname = normalize(keeper.get("nickname", ""))
    duplicate_nickname = normalize(duplicate.get("nickname", ""))

    if duplicate_generic and not keeper_generic and keeper_nickname and keeper_nickname == duplicate_nickname:
        return "high", "generic Player row shares the same nickname as a full-name row"

    if duplicate_generic and not keeper_generic and normalize(duplicate.get("first_name", "")) == keeper_nickname:
        return "high", "generic Player first name matches the full-name row nickname"

    if duplicate_generic and not keeper_generic and group_key == keeper_nickname:
        return "high", "generic Player row falls into the same nickname bucket as the full-name row"

    if keeper_nickname and keeper_nickname == duplicate_nickname:
        return "medium", "same normalized nickname"

    if normalize(keeper.get("first_name", "")) == normalize(duplicate.get("first_name", "")):
        return "medium", "same normalized first name"

    return "low", "manual review needed"


def build_review_rows(rows: list[dict]) -> list[dict]:
    review_rows = []
    seen_pairs = set()
    groups = build_groups(rows)
    for group_key, members in sorted(groups.items()):
        if len(members) < 2:
            continue
        sorted_members = sorted(members, key=sort_key_for_keeper)
        keeper = sorted_members[0]
        for duplicate in sorted_members[1:]:
            confidence, reason = reason_for_pair(keeper, duplicate, group_key)
            pair_key = (keeper["id"], duplicate["id"])
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)
            review_rows.append(build_review_row(keeper, duplicate, group_key, confidence, reason))

    generic_rows = [row for row in rows if normalize(row.get("last_name", "")) == "player"]
    nongeneric_rows = [row for row in rows if not is_generic_last_name(row)]
    for duplicate in generic_rows:
        duplicate_key = normalize(duplicate.get("nickname", "")) or normalize(duplicate.get("first_name", ""))
        if not duplicate_key:
            continue
        alias_bucket = ALIAS_EQUIVALENTS.get(duplicate_key, {duplicate_key})
        candidates = []
        for keeper in nongeneric_rows:
            keeper_tokens = {
                normalize(keeper.get("first_name", "")),
                normalize(keeper.get("last_name", "")),
                normalize(keeper.get("nickname", "")),
                normalize(display_name(keeper)),
            }
            if alias_bucket & {token for token in keeper_tokens if token}:
                candidates.append(keeper)
        if len(candidates) != 1:
            continue
        keeper = sorted(candidates, key=sort_key_for_keeper)[0]
        pair_key = (keeper["id"], duplicate["id"])
        if pair_key in seen_pairs:
            continue
        seen_pairs.add(pair_key)
        review_rows.append(
            build_review_row(
                keeper,
                duplicate,
                duplicate_key,
                "medium",
                "alias-based match between a generic Player row and a fuller player record",
            )
        )

    review_rows.sort(key=lambda row: (row["confidence"], row["group_key"], int(row["suggested_keeper_id"]), int(row["duplicate_id"])))
    return review_rows


def build_review_row(keeper: dict, duplicate: dict, group_key: str, confidence: str, reason: str) -> dict:
    return {
        "review_status": "",
        "approved_action": "merge",
        "confidence": confidence,
        "group_key": group_key,
        "reason": reason,
        "suggested_keeper_id": keeper["id"],
        "suggested_keeper_name": display_name(keeper),
        "suggested_keeper_nickname": keeper.get("nickname", ""),
        "duplicate_id": duplicate["id"],
        "duplicate_name": display_name(duplicate),
        "duplicate_nickname": duplicate.get("nickname", ""),
        "keeper_last_name": keeper.get("last_name", ""),
        "duplicate_last_name": duplicate.get("last_name", ""),
        "keeper_status": keeper.get("status", ""),
        "duplicate_status": duplicate.get("status", ""),
        "keeper_created_at": keeper.get("created_at", ""),
        "duplicate_created_at": duplicate.get("created_at", ""),
        "notes": "",
    }


def write_csv(path: Path, rows: list[dict]) -> None:
    fieldnames = [
        "review_status",
        "approved_action",
        "confidence",
        "group_key",
        "reason",
        "suggested_keeper_id",
        "suggested_keeper_name",
        "suggested_keeper_nickname",
        "duplicate_id",
        "duplicate_name",
        "duplicate_nickname",
        "keeper_last_name",
        "duplicate_last_name",
        "keeper_status",
        "duplicate_status",
        "keeper_created_at",
        "duplicate_created_at",
        "notes",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: generate_player_duplicate_review.py <input.csv> <output.csv>")
        return 1

    input_path = Path(sys.argv[1]).expanduser()
    output_path = Path(sys.argv[2]).expanduser()
    rows = parse_csv(input_path)
    review_rows = build_review_rows(rows)
    write_csv(output_path, review_rows)
    print(f"input_rows={len(rows)}")
    print(f"review_rows={len(review_rows)}")
    print(f"output={output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
