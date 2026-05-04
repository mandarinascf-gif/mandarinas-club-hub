# Mandarinas CF Production Readiness Audit

Date: 2026-05-03

## Scope

- Repo surface audit
- Published asset/link audit
- Frontend-to-Supabase query audit
- Live production Supabase spot-check against the deployed project
- Minimal safe cleanup for go-live prep

## Published App Surface

GitHub Pages currently deploys:

- top-level `*.html`
- `assets/`

It does not publish:

- `sql/`
- `scripts/`
- `data/`
- `docs/`
- `deliverables/`

## Files To Keep

### Published pages

- `home.html`
- `schedule.html`
- `roster.html`
- `public_standings.html`
- `submissions.html`
- `tier_watch.html`
- `tier_system.html`
- `videos.html`
- `busses.html`
- `seasons.html`
- `matchday.html`
- `squad.html`
- `player.html`
- `standings.html`
- `tiers.html`
- `setup.html`
- `index.html` and `manual.html` as compatibility redirects to `home.html`
- `ratings.html` as a compatibility redirect to `submissions.html`

### Runtime assets

- `assets/css/app.css`
- `assets/js/core/*`
- `assets/js/pages/admin/*` except the removed dead file noted below
- `assets/js/pages/public/*` except the removed dead file noted below
- `assets/js/pages/shared/standings.js`
- `assets/js/ui/*`
- referenced icons, flags, lineup tokens, brand images, badge assets, and champion art
- `site.webmanifest`

### Operational / source-of-truth files

- `sql/01_schema.sql` through `sql/09_rename_tier_statuses.sql`
- `sql/11_matchday_team_captains.sql` through `sql/16_restore_season_delete_policy.sql`
- `sql/17_live_production_readiness_patch.sql`
- `sql/archive/` historical scripts
- `scripts/`
- `data/`
- `deliverables/guides/`
- `README.md`

## Removed / Archived In This Pass

### Removed

- `assets/js/pages/public/ratings.js`
  Reason: no HTML page loads it anymore; `ratings.html` is now only a redirect.

### Archived

- `sql/10_seed_summer_2026_core_flex.sql`
  Reason: conflicts with the no-preseed Summer 2026 requirement.
- `sql/restore_2026_spring_snapshot_2026_04_23.sql`
  Reason: one-off restore snapshot, not a live migration.
- `sql/season_2026_spring_seed.sql`
  Reason: legacy seed superseded by `sql/03_seed_current.sql`.
- `sql/season_history_seed.sql`
  Reason: legacy seed superseded by `sql/02_seed_history.sql`.

## Questionable Files Not Touched

- `player-card.html`
  Reason: prototype/utility page, not deployed from navigation, but still useful for badge work.
- `deliverables/badge-preview.html`
  Reason: local preview utility for `player_badge.js`.
- older image variants in `assets/images/lineup/` and `assets/images/player-badge/`
  Reason: some are likely dead, but image cleanup needs a separate pass to avoid removing design assets still used in manual workflows.
- `scripts/`, `data/`, and existing `sql/archive/` contents
  Reason: operational/history inputs rather than live runtime assets.

## Frontend Findings

### Fixed

- Public/admin default season selection could jump to the future pre-created season if it sorted last chronologically.
  Fix: public pages and season-driven admin pages now default to the latest non-future season unless a specific `season_id` is requested.

### Local wiring status

- Local runtime asset requests for `home.html` loaded without local 404s during headless smoke checks.
- Navigation/page wiring is internally consistent across club and Busses surfaces.
- `ratings.html` is intentionally a redirect and no longer needs a dedicated page script.

## Live Database Findings

The live project was queried directly through the production Supabase REST API on 2026-05-03.

### Confirmed seasons in production

- `id=4` `2025 Winter`
- `id=5` `2025 Spring`
- `id=6` `2025 Summer`
- `id=7` `2025 Fall`
- `id=8` `2025 Holiday`
- `id=9` `2025 Solstice`
- `id=10` `2026 Winter`
- `id=11` `2026 Spring`
- `id=12` `Summer 2026`

This means production currently has 9 seasons, not 8.

### Summer 2026 status

`Summer 2026` is not just an empty shell. Production already contains:

- 8 matchdays (`id=87..94`)
- 67 `season_players` rows
- 1 approved `season_roster_requests` row
- seeded `matchday_matches` rows for matchday 1
- seeded `matchday_assignments` rows for matchday 1
- seeded `matchday_player_stats` rows for matchday 1

No auto-delete was included in the migration because this season already has attached activity. The optional delete block stays commented in the SQL patch.

### Confirmed frontend/schema mismatches

1. `public.matchdays` in production is missing `final_captain_order_enabled`.
   Impact: `assets/js/pages/admin/matchday.js` already falls back for reads, but saving the final captain mode toggle requires the SQL patch.

2. `public.matchday_team_captains` is missing from the live schema cache.
   Impact: captain tracking cannot persist until the SQL patch is applied.

3. `public.v_season_tier_transparency` still emits legacy `recommended_tier_status='flex_sub'`.
   Impact: client-side normalization masks this in parts of the UI, but the live view is stale and should be canonicalized.

4. `public.v_rotation_priority` returned no rows for `season_id=12` even though that season has flex players.
   Impact: the live rotation-priority board is functionally broken until the canonical view is recreated.

### Confirmed tables/views present

- `players`
- `seasons`
- `season_players`
- `season_roster_requests`
- `matchdays`
- `matchday_matches`
- `matchday_player_stats`
- `matchday_stat_submissions`
- `matchday_player_ratings`
- `matchday_suggestions`
- `v_season_tier_transparency`
- `v_rotation_priority`

## Security / RLS Concerns

1. Busses admin access is still a browser-side shared code gate.
   Source: `assets/js/core/admin_auth.js`
   Current fallback code: `201118`

2. The static app still relies on anonymous browser writes by design.
   This is consistent with the current post-`sql/15_code_gate_revert.sql` model, but it is not strong backend admin security.

3. The production publishable key is embedded client-side.
   This is normal for Supabase browser clients, but it raises the importance of correct RLS and keeping privileged operations out of anonymous policies.

## Production Cleanup Plan

### Step 1

Apply `sql/17_live_production_readiness_patch.sql`.

Why first:

- fixes the verified production schema gaps
- restores captain persistence
- restores the final captain mode column
- rebuilds the live tier views to canonical `core/flex/sub`

### Step 2

Decide whether to remove `Summer 2026` now.

- If yes: use the commented delete block at the bottom of `sql/17_live_production_readiness_patch.sql`
- If no: the new season-default logic will stop public/admin defaults from jumping to it automatically, but the DB will still contain 9 seasons

### Step 3

After SQL is applied, verify:

- public pages now default to `2026 Spring` until a future season is intentionally live
- Busses matchday captain actions save successfully
- rotation-priority rows render again for seasons with flex players

## Files Changed In This Pass

- `assets/js/core/club_logic.js`
- `assets/js/core/app.js`
- `assets/js/pages/admin/seasons.js`
- `assets/js/pages/admin/tiers.js`
- `assets/js/pages/admin/matchday.js`
- `sql/17_live_production_readiness_patch.sql`
- archived/removed files listed above

## Final Verification Checklist

- [ ] app loads with no console errors on public pages
- [ ] Busses access gate works
- [ ] seasons load from Supabase
- [ ] only 8 approved seasons remain live, if `Summer 2026` is intentionally removed
- [ ] `Summer 2026` is not pre-seeded unless you explicitly keep it
- [ ] new season creation works from Season Centre
- [ ] players load
- [ ] matchdays load
- [ ] results can be entered
- [ ] standings update correctly
- [ ] player cards use all-time data correctly
- [ ] mobile layouts still behave correctly on public and admin pages
