-- STEP 5: Season workflow upgrade — add schedule defaults and season signup metadata.
-- Run this on an existing live project after 01..04 if you want the richer admin season workflow
-- without rebuilding the database from scratch.

begin;

alter table public.seasons
  add column if not exists season_start_date date,
  add column if not exists default_matchday_weekday integer,
  add column if not exists default_kickoff_time time without time zone,
  add column if not exists venue_name text;

update public.seasons
set venue_name = 'Alden E. Oliver'
where venue_name is null
   or btrim(venue_name) = '';

alter table public.seasons
  alter column venue_name set default 'Alden E. Oliver',
  alter column venue_name set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seasons_default_matchday_weekday_range'
  ) then
    alter table public.seasons
      add constraint seasons_default_matchday_weekday_range check (
        default_matchday_weekday is null or default_matchday_weekday between 0 and 6
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'seasons_venue_name_length'
  ) then
    alter table public.seasons
      add constraint seasons_venue_name_length check (
        char_length(trim(venue_name)) between 3 and 80
      );
  end if;
end;
$$;

alter table public.season_players
  add column if not exists registration_tier text,
  add column if not exists payment_status text;

update public.season_players
set registration_tier = case
  when lower(coalesce(registration_tier, '')) in ('core', 'rotation', 'flex_sub')
    then lower(registration_tier)
  when lower(coalesce(tier_status, '')) in ('core', 'rotation', 'flex_sub')
    then lower(tier_status)
  else 'rotation'
end
where registration_tier is null
   or lower(coalesce(registration_tier, '')) not in ('core', 'rotation', 'flex_sub');

update public.season_players
set payment_status = case
  when lower(coalesce(payment_status, '')) in ('unknown', 'pending', 'paid', 'comped')
    then lower(payment_status)
  else 'unknown'
end
where payment_status is null
   or lower(coalesce(payment_status, '')) not in ('unknown', 'pending', 'paid', 'comped');

alter table public.season_players
  alter column registration_tier set default 'rotation',
  alter column registration_tier set not null,
  alter column payment_status set default 'unknown',
  alter column payment_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'season_players_registration_tier_allowed'
  ) then
    alter table public.season_players
      add constraint season_players_registration_tier_allowed check (
        registration_tier in ('core', 'rotation', 'flex_sub')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'season_players_payment_status_allowed'
  ) then
    alter table public.season_players
      add constraint season_players_payment_status_allowed check (
        payment_status in ('unknown', 'pending', 'paid', 'comped')
      );
  end if;
end;
$$;

commit;
