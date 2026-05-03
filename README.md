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

Busses pages now require a real Supabase Auth session plus a player-linked
`public.admin_allowed_emails` row that matches the signed-in email address.

For an existing live project:

- run `sql/09_admin_auth_hardening.sql`
- run `sql/13_admin_magic_link_allowlist.sql`
- run `sql/14_player_linked_busses_access.sql`
- in Supabase Auth Email Templates, switch the email sign-in template to send the 6-digit OTP
  code using `{{ .Token }}`
- add the first admin email to `public.admin_allowed_emails`, linked to the right `players.id`

After the first admin can sign in, manage these fields from the Busses Squad player editor:

- `Admin sign-in email`
- `Busses access`

The Busses sign-in page now uses email OTP instead of magic links, which is more reliable for a
home-screen bookmark flow because it does not depend on redirect handling.

Example:

```sql
insert into public.admin_allowed_emails (player_id, email, is_active, note)
values (123, 'you@example.com', true, 'Primary Busses admin');
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
