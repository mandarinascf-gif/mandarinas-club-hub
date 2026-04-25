begin;

-- Additive integrity patch for live projects.
-- Enforces that any player used in matchday assignments/stats
-- must also belong to the season roster for that matchday.

create or replace function public.enforce_matchday_player_on_season_roster()
returns trigger
language plpgsql
as $$
declare
  roster_exists boolean;
begin
  select exists (
    select 1
    from public.matchdays md
    join public.season_players sp
      on sp.season_id = md.season_id
    where md.id = new.matchday_id
      and sp.player_id = new.player_id
  )
  into roster_exists;

  if not roster_exists then
    raise exception using
      errcode = '23514',
      message = format(
        'Player %s must belong to the season roster for matchday %s before saving %s.',
        new.player_id,
        new.matchday_id,
        tg_table_name
      ),
      detail = format('matchday_id=%s, player_id=%s', new.matchday_id, new.player_id),
      hint = 'Add the player to season_players for the matchday season, then retry.';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_orphaned_matchday_activity_from_season_roster_changes()
returns trigger
language plpgsql
as $$
declare
  affected_matchday_count integer;
begin
  select count(distinct md.id)
  into affected_matchday_count
  from public.matchdays md
  where md.season_id = old.season_id
    and (
      exists (
        select 1
        from public.matchday_assignments ma
        where ma.matchday_id = md.id
          and ma.player_id = old.player_id
      )
      or exists (
        select 1
        from public.matchday_player_stats mps
        where mps.matchday_id = md.id
          and mps.player_id = old.player_id
      )
    );

  if affected_matchday_count > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'Cannot remove player %s from season %s while matchday activity still exists.',
        old.player_id,
        old.season_id
      ),
      detail = format(
        'season_id=%s, player_id=%s, affected_matchdays=%s',
        old.season_id,
        old.player_id,
        affected_matchday_count
      ),
      hint = 'Delete or reassign the player''s matchday assignments and stats for that season before removing the season roster row.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_matchday_season_roster_integrity()
returns trigger
language plpgsql
as $$
declare
  invalid_player_count integer;
begin
  select count(*)
  into invalid_player_count
  from (
    select distinct participant.player_id
    from (
      select ma.player_id
      from public.matchday_assignments ma
      where ma.matchday_id = new.id

      union

      select mps.player_id
      from public.matchday_player_stats mps
      where mps.matchday_id = new.id
    ) participant
    left join public.season_players sp
      on sp.season_id = new.season_id
     and sp.player_id = participant.player_id
    where sp.id is null
  ) invalid_players;

  if invalid_player_count > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'Cannot move matchday %s to season %s because some existing players are not on that season roster.',
        new.id,
        new.season_id
      ),
      detail = format('matchday_id=%s, season_id=%s, invalid_players=%s', new.id, new.season_id, invalid_player_count),
      hint = 'Add the players to the destination season roster or clear the matchday assignments/stats before changing the matchday season.';
  end if;

  return new;
end;
$$;

drop trigger if exists season_players_preserve_matchday_integrity on public.season_players;
create constraint trigger season_players_preserve_matchday_integrity
after delete or update of season_id, player_id on public.season_players
deferrable initially deferred
for each row
execute procedure public.prevent_orphaned_matchday_activity_from_season_roster_changes();

drop trigger if exists matchdays_validate_season_roster_integrity on public.matchdays;
create constraint trigger matchdays_validate_season_roster_integrity
after update of season_id on public.matchdays
deferrable initially deferred
for each row
execute procedure public.enforce_matchday_season_roster_integrity();

drop trigger if exists matchday_player_stats_require_season_roster on public.matchday_player_stats;
create constraint trigger matchday_player_stats_require_season_roster
after insert or update of matchday_id, player_id on public.matchday_player_stats
deferrable initially deferred
for each row
execute procedure public.enforce_matchday_player_on_season_roster();

drop trigger if exists matchday_assignments_require_season_roster on public.matchday_assignments;
create constraint trigger matchday_assignments_require_season_roster
after insert or update of matchday_id, player_id on public.matchday_assignments
deferrable initially deferred
for each row
execute procedure public.enforce_matchday_player_on_season_roster();

commit;

select
  to_regprocedure('public.enforce_matchday_player_on_season_roster()') is not null as roster_guard_ready,
  to_regprocedure('public.prevent_orphaned_matchday_activity_from_season_roster_changes()') is not null as roster_delete_guard_ready,
  to_regprocedure('public.enforce_matchday_season_roster_integrity()') is not null as matchday_season_guard_ready;
