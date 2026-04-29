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

The busses gate reads from `window.__MANDARINAS_APP_CONFIG__` first. For this static site, the
default local source of truth is `assets/js/core/runtime_config.js`, where `adminCode` is defined
in one place. `window.__MANDARINAS_SUPABASE_CONFIG__`, `ADMIN_CODE`, and `NEXT_PUBLIC_ADMIN_CODE`
are still accepted as fallback override keys. If no override is present, it falls back to `1234`.

## Current caveats

- Busses access is currently a client-side code gate, not real authentication.
- Some player-report actions may remain in view mode until the related Supabase migration is applied.
- This repo includes club data artifacts under `data/` and SQL seed files. Review that content before publishing publicly.
