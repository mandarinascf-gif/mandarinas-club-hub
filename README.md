# Mandarinas Club Hub

Static club and busses workspace for Mandarinas CF.

## What is here

- Public-facing club pages for fixtures, standings, squad, pathway, and tracker
- Busses-only workspace pages for squad management, seasons, matchday control, standings, and planner
- Supabase-backed data access from the browser
- SQL and helper scripts for schema setup, reseeding, and maintenance

## Local run

Serve the project root as a static site. For example:

```bash
python3 -m http.server 8899
```

Then open:

```text
http://127.0.0.1:8899/home.html
```

## Supabase config

The browser app reads Supabase config from:

- `window.__MANDARINAS_SUPABASE_CONFIG__`, if provided at runtime
- fallback values in `assets/js/core/supabase_config.js`

For local env reference, see `.env.example`.

## Busses admin access

Busses pages now require a real Supabase Auth session plus an active
`public.admin_allowed_emails` row that matches the signed-in email address.

For an existing live project:

- run `sql/09_admin_auth_hardening.sql`
- run `sql/13_admin_magic_link_allowlist.sql`
- in Supabase Auth URL Configuration, set the site URL and add the production `busses.html` URL
  to Redirect URLs
- insert each admin email into `public.admin_allowed_emails`

Example:

```sql
insert into public.admin_allowed_emails (email, note)
values ('you@example.com', 'Primary Busses admin');
```

For fresh setups, `sql/01_schema.sql` now creates the same table/function/policies directly.
`public.player_accounts` remains available for future player-to-account linking, but it is no
longer the source of truth for Busses admin access.

For workbook-backed reseed scripts, the folder source of truth is
`data/reseed_config/season_inventory.csv`. Current-season generation, historical repair helpers,
and canonical reseed/report scripts should resolve workbooks from that inventory instead of from
machine-specific `Downloads` paths.

## Current caveats

- Public player submissions and idea-board writes still use the existing open client workflow.
- Some player-report actions may remain in view mode until the related Supabase migration is applied.
- This repo includes club data artifacts under `data/` and SQL seed files. Review that content before publishing publicly.
