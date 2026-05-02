-- Migration: Rename tier statuses
-- core stays core
-- rotation becomes flex
-- flex_sub / flex/sub becomes sub
--
-- Run this against your Supabase database to update existing data.
-- The JS app already handles legacy values gracefully via normalizeTierValue(),
-- so this migration is safe to run at any time.

-- Players table: status and desired_tier columns
update public.players
  set status = 'flex'
  where status = 'rotation';

update public.players
  set status = 'sub'
  where status in ('flex_sub', 'flex/sub');

update public.players
  set desired_tier = 'flex'
  where desired_tier = 'rotation';

update public.players
  set desired_tier = 'sub'
  where desired_tier in ('flex_sub', 'flex/sub');

-- Season players table: tier_status and registration_tier columns
update public.season_players
  set tier_status = 'flex'
  where tier_status = 'rotation';

update public.season_players
  set tier_status = 'sub'
  where tier_status in ('flex_sub', 'flex/sub');

update public.season_players
  set registration_tier = 'flex'
  where registration_tier = 'rotation';

update public.season_players
  set registration_tier = 'sub'
  where registration_tier in ('flex_sub', 'flex/sub');

-- Season roster requests table
update public.season_roster_requests
  set requested_tier = 'flex'
  where requested_tier = 'rotation';

update public.season_roster_requests
  set requested_tier = 'sub'
  where requested_tier in ('flex_sub', 'flex/sub');

-- Update check constraints to use new values
alter table public.season_roster_requests
  drop constraint if exists season_roster_requests_requested_tier_check;

alter table public.season_roster_requests
  add constraint season_roster_requests_requested_tier_check
  check (requested_tier in ('core', 'flex', 'sub'));
