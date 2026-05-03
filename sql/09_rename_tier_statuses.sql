-- Migration: Rename tier statuses
-- core stays core
-- rotation becomes flex
-- flex_sub / flex/sub becomes sub
--
-- Run this against your Supabase database to update existing data.
-- The JS app already handles legacy values gracefully via normalizeTierValue(),
-- so this migration is safe to run at any time.

-- First widen the allowed tier labels so legacy databases can be rewritten
-- to the canonical core/flex/sub values in-place.
alter table public.players
  drop constraint if exists players_desired_tier_allowed;

alter table public.players
  add constraint players_desired_tier_allowed
  check (desired_tier in ('core', 'flex', 'sub', 'rotation', 'flex_sub', 'flex/sub'));

alter table public.players
  drop constraint if exists players_status_allowed;

alter table public.players
  add constraint players_status_allowed
  check (status in ('core', 'flex', 'sub', 'rotation', 'flex_sub', 'flex/sub'));

alter table public.season_players
  drop constraint if exists season_players_tier_status_allowed;

alter table public.season_players
  add constraint season_players_tier_status_allowed
  check (tier_status in ('core', 'flex', 'sub', 'rotation', 'flex_sub', 'flex/sub'));

alter table public.season_players
  drop constraint if exists season_players_registration_tier_allowed;

alter table public.season_players
  add constraint season_players_registration_tier_allowed
  check (registration_tier in ('core', 'flex', 'sub', 'rotation', 'flex_sub', 'flex/sub'));

alter table public.season_roster_requests
  drop constraint if exists season_roster_requests_requested_tier_allowed;

alter table public.season_roster_requests
  drop constraint if exists season_roster_requests_requested_tier_check;

alter table public.season_roster_requests
  add constraint season_roster_requests_requested_tier_allowed
  check (requested_tier in ('core', 'flex', 'sub', 'rotation', 'flex_sub', 'flex/sub'));

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

-- Tighten the constraints back down to the canonical labels.
alter table public.players
  drop constraint if exists players_desired_tier_allowed;

alter table public.players
  add constraint players_desired_tier_allowed
  check (desired_tier in ('core', 'flex', 'sub'));

alter table public.players
  drop constraint if exists players_status_allowed;

alter table public.players
  add constraint players_status_allowed
  check (status in ('core', 'flex', 'sub'));

alter table public.season_players
  drop constraint if exists season_players_tier_status_allowed;

alter table public.season_players
  add constraint season_players_tier_status_allowed
  check (tier_status in ('core', 'flex', 'sub'));

alter table public.season_players
  drop constraint if exists season_players_registration_tier_allowed;

alter table public.season_players
  add constraint season_players_registration_tier_allowed
  check (registration_tier in ('core', 'flex', 'sub'));

alter table public.season_roster_requests
  drop constraint if exists season_roster_requests_requested_tier_allowed;

alter table public.season_roster_requests
  drop constraint if exists season_roster_requests_requested_tier_check;

alter table public.season_roster_requests
  add constraint season_roster_requests_requested_tier_allowed
  check (requested_tier in ('core', 'flex', 'sub'));
