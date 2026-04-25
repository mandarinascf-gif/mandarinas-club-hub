#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import sys

import generate_2026_spring_seed as seed


def build_payload(workbook_path: Path) -> dict:
    player_csv_path = seed.resolve_player_csv_path()
    player_profiles = seed.parse_player_profiles(player_csv_path)
    workbook = seed.WorkbookReader(workbook_path)

    try:
        match_dates = seed.parse_match_dates(workbook.read_rows("MATCH_DATES"))
        total_matchdays = max((matchday_number for matchday_number, _ in match_dates), default=8)
        goals_as_points_matchdays = {
            matchday_number
            for matchday_number, _ in match_dates
            if matchday_number >= seed.GOALS_AS_POINTS_START
        }

        player_map, assignments, attendance_rows, resolved_map = seed.parse_weekly_teams(
            workbook.read_rows("WEEKLY_TEAMS"),
            total_matchdays,
        )
        stats_by_key = seed.parse_player_stats(workbook.read_rows("PLAYER_STAT"), resolved_map)
        match_rows = seed.parse_match_rows(workbook.read_rows("MATCH_INPUT"))
    finally:
        workbook.close()

    attendance_map = {
        (label, matchday_number): attended
        for label, matchday_number, attended in attendance_rows
    }
    stat_keys = set(attendance_map) | set(stats_by_key)

    stat_rows = []
    for import_label, matchday_number in sorted(stat_keys, key=lambda item: (item[1], item[0])):
        goals, goal_keeps, clean_sheet = stats_by_key.get((import_label, matchday_number), (0, 0, False))
        attended = attendance_map.get(
            (import_label, matchday_number),
            True if (import_label, matchday_number) in stats_by_key else False,
        )
        stat_rows.append(
            {
                "import_label": import_label,
                "matchday_number": matchday_number,
                "attended": attended,
                "attendance_status": "in" if attended else "out",
                "goals": goals,
                "goal_keeps": goal_keeps,
                "clean_sheet": clean_sheet,
            }
        )

    sorted_aliases = sorted(
        player_map.items(),
        key=lambda item: (item[0].lower(), item[1].last_name.lower(), item[1].first_name.lower()),
    )

    seen_identities: dict[tuple[str, str], str] = {}
    deduplicated_aliases: list[tuple[str, seed.PlayerIdentity]] = []
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
        key=lambda identity: (
            identity.last_name.lower(),
            identity.first_name.lower(),
            (identity.nickname or "").lower(),
        ),
    )

    remapped_assignments = []
    seen_assignment_keys: set[tuple[str, int]] = set()
    for import_label, matchday_number, team_code in assignments:
        canonical_label = removed_aliases.get(import_label, import_label)
        key = (canonical_label, matchday_number)
        if key in seen_assignment_keys:
            continue
        seen_assignment_keys.add(key)
        remapped_assignments.append(
            {
                "import_label": canonical_label,
                "matchday_number": matchday_number,
                "team_code": team_code,
            }
        )

    remapped_stats = []
    seen_stat_keys: set[tuple[str, int]] = set()
    for row in stat_rows:
        canonical_label = removed_aliases.get(row["import_label"], row["import_label"])
        key = (canonical_label, row["matchday_number"])
        if key in seen_stat_keys:
            continue
        seen_stat_keys.add(key)
        remapped_stats.append(
            {
                **row,
                "import_label": canonical_label,
            }
        )

    players = []
    for identity in sorted_players:
        profile = seed.identity_profile(identity, player_profiles)
        players.append(
            {
                "first_name": identity.first_name,
                "last_name": identity.last_name,
                "nickname": identity.nickname,
                "nationality": profile.nationality,
                "positions": list(profile.positions),
                "desired_tier": identity.status,
                "status": identity.status,
            }
        )

    aliases = [
        {
            "import_label": import_label,
            "first_name": identity.first_name,
            "last_name": identity.last_name,
            "nickname": identity.nickname,
            "tier_status": identity.status,
        }
        for import_label, identity in deduplicated_aliases
    ]

    core_spots = sum(1 for player in players if player["status"] == "core")
    rotation_spots = sum(1 for player in players if player["status"] == "rotation")

    return {
      "season": {
        "name": seed.SEASON_NAME,
        "total_matchdays": total_matchdays,
        "core_spots": core_spots,
        "rotation_spots": rotation_spots,
        "model_start_matchday": 1,
        "attendance_points": seed.ATTENDANCE_POINTS,
        "win_points": seed.WIN_POINTS,
        "draw_points": seed.DRAW_POINTS,
        "loss_points": seed.LOSS_POINTS,
        "goal_keep_points": seed.GOAL_KEEP_POINTS,
        "team_goal_points": seed.TEAM_GOAL_POINTS,
      },
      "players": players,
      "aliases": aliases,
      "matchdays": [
        {
          "matchday_number": matchday_number,
          "kickoff_at": f"{date_value}T12:00:00-08:00",
          "goals_count_as_points": matchday_number in goals_as_points_matchdays,
        }
        for matchday_number, date_value in match_dates
      ],
      "matches": [
        {
          "matchday_number": matchday_number,
          "round_number": round_number,
          "match_order": match_order,
          "home_team_code": home_team,
          "away_team_code": away_team,
          "home_score": home_score,
          "away_score": away_score,
        }
        for matchday_number, round_number, match_order, home_team, away_team, home_score, away_score in match_rows
      ],
      "assignments": remapped_assignments,
      "stats": remapped_stats,
      "season_players": [
        {
          "import_label": import_label,
          "tier_status": identity.status,
          "tier_reason": "Seeded from the latest 2026 Spring workbook.",
          "movement_note": "Recalculate after reviewing availability, late cancels, and no-shows.",
          "is_eligible": True,
        }
        for import_label, identity in deduplicated_aliases
      ],
    }


def main() -> None:
    workbook_path = (
        Path(sys.argv[1]).expanduser().resolve()
        if len(sys.argv) > 1
        else seed.resolve_workbook_path()
    )
    payload = build_payload(workbook_path)
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
