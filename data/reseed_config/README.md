Active reseed config lives here.

Files:
- `season_inventory.csv`
- `identity_map.csv`
- `buddy_overrides.csv`

Workflow:
1. Put one raw workbook export in each season folder under `data/reseed_source/<season_slug>/workbook.xlsx`.
2. Put any shared player profile workbook exports under `data/reseed_source/reference_profiles/`.
3. Mark `ready_for_import=yes` in `season_inventory.csv` only when that season has the workbook in place and the identity rules are reviewed.
4. Add canonical alias and sub-merge rules to `identity_map.csv`.
5. Slash rows are duplicated into each real player during the dry run. Use `buddy_overrides.csv` only for rare non-default exceptions that should still force one target.
6. Run:
   `python3 scripts/generate_canonical_import_report.py`
7. Review:
   - `data/reseed_reports/canonical_import_report.json`
   - `data/reseed_reports/canonical_import_report.md`
8. Generate the reseed SQL:
   `python3 scripts/generate_canonical_reseed_sql.py`
9. Run the standard SQL setup flow:
   - `sql/01_schema.sql`
   - `sql/02_seed_history.sql`
   - `sql/03_seed_current.sql`

The report is the gate before any destructive Supabase reseed. It does not write to Supabase.
