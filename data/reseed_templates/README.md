# Full Reseed Templates

Use these files when you want to rebuild Supabase from corrected season history.

For active editing, use `data/reseed_config/` instead of changing the templates in place.
The dry-run report reads:
- `data/reseed_config/season_inventory.csv`
- `data/reseed_config/identity_map.csv`
- `data/reseed_config/buddy_overrides.csv`

Put your source exports here:
- `data/reseed_source/<season_name>/workbook.xlsx`
- optional CSV tabs from the same season workbook in that same folder

Recommended season folder example:
- `data/reseed_source/2026_spring/workbook.xlsx`
- `data/reseed_source/2026_spring/MATCH_DATES.csv`
- `data/reseed_source/2026_spring/WEEKLY_TEAMS.csv`
- `data/reseed_source/2026_spring/MATCH_INPUT.csv`
- `data/reseed_source/2026_spring/PLAYER_STAT.csv`
- `data/reseed_source/2026_spring/LEAGUE_STANDINGS.csv`
- `data/reseed_source/2026_spring/PLAYER_PROFILE.csv`

Fill out these templates:
- `identity_map_template.csv`
- `buddy_overrides_template.csv`
- `season_inventory_template.csv`

What each file does:
- `identity_map_template.csv`
  - one canonical player per row
  - defines aliases across seasons
  - tells us when `(Sub) Name` should merge into the real player
- `buddy_overrides_template.csv`
  - only for rare rows that still need a forced target
  - slash pairs are normally split into both real players during the canonical rebuild
- `season_inventory_template.csv`
  - one row per season export
  - helps track what files exist and whether a season is ready to import

Export rules from Google Sheets:
1. Export the whole workbook as `.xlsx`.
2. Export each important tab as `.csv` when possible.
3. Keep the sheet names unchanged.
4. Do not edit the raw exports after download.
5. If a player was sometimes tracked as a sub and sometimes as a normal player, record that in `identity_map_template.csv`.

Minimum tabs per season:
- `MATCH_DATES`
- `WEEKLY_TEAMS` or `WEEKLY_ROSTER`
- `MATCH_INPUT`
- `PLAYER_STAT`
- `LEAGUE_STANDINGS`

Helpful extra tabs:
- `PLAYER_PROFILE`
- `FORM`
- any sheet that explains attendance, late cancels, or substitutions

When the files are ready, tell me:
- which seasons are included
- where you placed the exports
- whether the identity map is complete or still partial
