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

Busses pages use a shared browser-side code gate again.

The current built-in code is:

```text
201118
```

For an existing live project that already applied the auth/RLS hardening rollout, run:

- `sql/15_code_gate_revert.sql`

That migration removes the Busses auth tables/function and reopens the legacy anonymous write
policies used by the static admin pages. For fresh setups, `sql/01_schema.sql` now matches that
same code-gated behavior directly.

For workbook-backed reseed scripts, the folder source of truth is
`data/reseed_config/season_inventory.csv`. Current-season generation, historical repair helpers,
and canonical reseed/report scripts should resolve workbooks from that inventory instead of from
machine-specific `Downloads` paths.

## Current caveats

- Public player submissions and idea-board writes still use the existing open client workflow.
- The Busses code gate is only a browser-side separation layer, not real backend access control.
- This repo includes club data artifacts under `data/` and SQL seed files. Review that content before publishing publicly.
