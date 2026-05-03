# Player Self-Service Roadmap

This note captures the next product requirements so the iPhone UI work stays compatible with the
future player-facing workflow.

## New requirements

1. After each matchday, players get **12 hours** to submit their own stats.
2. As part of that same flow, players can also submit the **match scores** they observed.
3. The system should prefer the **most common score input** for each match.
4. Admins must still be able to **override** the final saved score.
5. Players get **1 week** after the matchday to rate players they played **with** and **against**.
6. Rating prompts should use soccer-specific questions, not generic star ratings.

## Current blocker

The current app has **no player authentication model**.

Today:

- Busses admin pages now use Supabase Auth plus `public.player_accounts`.
- Public read paths and player-submission writes still rely on the open client model.
- There is no stable relationship between a logged-in user and a specific `players.id`.

That means player-submitted stats and ratings should **not** be implemented on top of the current
anonymous model.

## Readiness verdict

The product flow is ready to be designed now, but the security model is **not ready for launch** yet.

Today the app still relies on:

- anonymous client access for public reads and player submission flows
- no verified mapping between an authenticated person and a `players.id`

So the honest answer is:

- **yes**, we can start implementing the claim flow and role split next
- **no**, we should not ship player claiming or player submissions on the current open-anon model

The first milestone has to be auth and RLS, not the submission forms themselves.

## Profile-claim flow

Recommended claim flow:

1. Player signs in with Supabase Auth.
2. Player requests ownership of one existing roster profile.
3. Admin approves that claim.
4. The approved auth user gets linked to `public.player_accounts.player_id`.
5. RLS then allows that player to see private self-service screens and submit only their own records.

Important guardrail:

- claiming should attach users to **existing** player records
- it should not create a duplicate player profile automatically
- admin approval should be required before write access is granted

## Admin vs non-admin split

Recommended role model:

- `player`: can read public data plus their own private submission screens
- `admin`: can manage canonical players, seasons, matchdays, assignments, stats, and overrides

Recommended technical source of truth:

- `public.player_accounts.role in ('player', 'admin')`

Then replace the current browser-only admin code with:

- Supabase Auth session
- role lookup from `public.player_accounts`
- RLS policies that distinguish player and admin capabilities

## Recommended backend changes

### 1. Add player identity

Create a new table that maps authenticated users to players:

- `public.player_accounts`
  - `id`
  - `auth_user_id uuid` references `auth.users(id)`
  - `player_id bigint` references `public.players(id)`
  - `role text check (role in ('player', 'admin'))`
  - `is_active boolean`
  - timestamps

This becomes the source of truth for:

- which player can submit stats
- which player can submit ratings
- which authenticated users can still act as admins

### 2. Add submission windows

Store player submission windows on the matchday itself or in a separate workflow table.

Recommended fields on `public.matchdays`:

- `player_stats_open_at timestamptz`
- `player_stats_close_at timestamptz`
- `player_ratings_close_at timestamptz`
- `admin_review_locked_at timestamptz`

Default behavior:

- stats window opens at kickoff or final whistle workflow
- stats closes `kickoff_at + interval '12 hours'`
- ratings close `kickoff_at + interval '7 days'`

### 3. Keep raw player submissions separate from canonical stats

Do not let player self-service write directly into `public.matchday_player_stats`.

Add:

- `public.matchday_stat_submissions`
  - `id`
  - `matchday_id`
  - `submitted_by_player_id`
  - `player_id`
  - `goals`
  - `goal_keeps`
  - `clean_sheet`
  - `attendance_status`
  - `submitted_at`
  - unique constraint on `(matchday_id, submitted_by_player_id, player_id)`

Use this pattern so admins can review conflicts before promoting values into the canonical admin
table `public.matchday_player_stats`.

### 4. Add raw score reports

Add:

- `public.match_score_submissions`
  - `id`
  - `matchday_id`
  - `match_id`
  - `submitted_by_player_id`
  - `home_score`
  - `away_score`
  - `submitted_at`
  - unique constraint on `(match_id, submitted_by_player_id)`

Consensus logic:

- group identical `(home_score, away_score)` submissions per match
- choose the scoreline with the highest count
- if tied, mark for admin review
- admin override always wins and writes into `public.matchday_matches`

### 5. Add soccer-specific player ratings

Add:

- `public.matchday_player_ratings`
  - `id`
  - `matchday_id`
  - `rater_player_id`
  - `ratee_player_id`
  - `relationship text check (relationship in ('teammate', 'opponent'))`
  - question score columns or a JSON payload
  - optional comment
  - `submitted_at`
  - unique constraint on `(matchday_id, rater_player_id, ratee_player_id)`

Recommended question set:

- First touch / ball control
- Passing / vision
- Defensive work
- Positioning / decision making
- Work rate / team play
- Overall impact on the match

Recommended scoring scale:

- `1` to `5` with clear anchors per question

### 6. Keep canonical ratings separate from raw ratings

Do not overwrite `players.skill_rating` directly from one submission cycle.

Instead:

- aggregate approved rating submissions into a season-level or rolling-match rating view
- let admins review outliers
- apply a weighted formula before updating the displayed player rating

## Recommended UI flow

### Player flow

1. Player signs in.
2. Player sees a personal dashboard with current submission windows.
3. If within 12 hours:
   - submit own stats
   - submit observed match scores
4. If within 7 days:
   - rate teammates and opponents from that matchday

### Admin flow

1. Matchday closes.
2. Admin sees:
   - consensus score suggestions
   - conflicting player stat submissions
   - rating completion status
3. Admin approves or overrides canonical match stats and scores.

## UI design implications

The iPhone front end should keep these future screens in mind:

- A player home/dashboard
- A submission countdown state
- A simple, one-handed stat form
- A ratings queue of players from the same matchday
- An admin review inbox for conflicts and overrides

That is why the current refactor should continue to favor:

- list-first navigation
- drill-in detail screens
- single-task forms
- large tap targets
- bottom-safe spacing for iPhone

## Next implementation order

1. Add authenticated player accounts and tighten RLS.
2. Add raw stat submission tables and score submission tables.
3. Add admin review screens for consensus + override.
4. Add player-facing stat submission flow.
5. Add player-facing rating flow.
6. Add derived rating logic and admin moderation.
