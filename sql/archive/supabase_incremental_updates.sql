begin;

-- Safe additive repair for the current Mandarinas CF app.
-- Run this on an existing live project.
-- It does not delete season/player/matchday data.

-- ---------------------------------------------------------------------------
-- Players: desired tier transition
-- ---------------------------------------------------------------------------
alter table public.players
add column if not exists desired_tier text;

update public.players
set
  desired_tier = coalesce(desired_tier, status, 'core'),
  status = coalesce(status, desired_tier, 'core');

alter table public.players
alter column desired_tier set default 'core';

alter table public.players
alter column desired_tier set not null;

create index if not exists players_desired_tier_idx
on public.players (desired_tier);

-- ---------------------------------------------------------------------------
-- Seasons: current scoring + team display config
-- ---------------------------------------------------------------------------
alter table public.seasons
add column if not exists core_spots integer;

alter table public.seasons
add column if not exists rotation_spots integer;

alter table public.seasons
add column if not exists model_start_matchday integer;

alter table public.seasons
add column if not exists attendance_points integer;

alter table public.seasons
add column if not exists win_points integer;

alter table public.seasons
add column if not exists draw_points integer;

alter table public.seasons
add column if not exists loss_points integer;

alter table public.seasons
add column if not exists goal_keep_points integer;

alter table public.seasons
add column if not exists team_goal_points integer;

alter table public.seasons
add column if not exists team_display_config jsonb;

update public.seasons
set
  core_spots = coalesce(core_spots, 0),
  rotation_spots = coalesce(rotation_spots, 0),
  model_start_matchday = greatest(1, least(coalesce(model_start_matchday, 1), total_matchdays)),
  attendance_points = coalesce(attendance_points, 2),
  win_points = coalesce(win_points, 2),
  draw_points = coalesce(draw_points, 1),
  loss_points = coalesce(loss_points, 0),
  goal_keep_points = coalesce(goal_keep_points, 1),
  team_goal_points = coalesce(team_goal_points, 1),
  team_display_config = coalesce(
    team_display_config,
    '{
      "magenta": { "label": "Magenta", "color": "#f472b6" },
      "blue": { "label": "Blue", "color": "#60a5fa" },
      "green": { "label": "Green", "color": "#4ade80" },
      "orange": { "label": "Orange", "color": "#fb923c" }
    }'::jsonb
  );

alter table public.seasons
alter column core_spots set default 0;

alter table public.seasons
alter column rotation_spots set default 0;

alter table public.seasons
alter column model_start_matchday set default 1;

alter table public.seasons
alter column attendance_points set default 2;

alter table public.seasons
alter column win_points set default 2;

alter table public.seasons
alter column draw_points set default 1;

alter table public.seasons
alter column loss_points set default 0;

alter table public.seasons
alter column goal_keep_points set default 1;

alter table public.seasons
alter column team_goal_points set default 1;

alter table public.seasons
alter column team_display_config
set default '{
  "magenta": { "label": "Magenta", "color": "#f472b6" },
  "blue": { "label": "Blue", "color": "#60a5fa" },
  "green": { "label": "Green", "color": "#4ade80" },
  "orange": { "label": "Orange", "color": "#fb923c" }
}'::jsonb;

alter table public.seasons
alter column team_display_config
set not null;

-- ---------------------------------------------------------------------------
-- Season players: tier board fields
-- ---------------------------------------------------------------------------
alter table public.season_players
add column if not exists tier_reason text;

alter table public.season_players
add column if not exists movement_note text;

alter table public.season_players
add column if not exists is_eligible boolean;

update public.season_players
set is_eligible = coalesce(is_eligible, true);

alter table public.season_players
alter column is_eligible set default true;

-- ---------------------------------------------------------------------------
-- Matchdays: scheduling / goal rule
-- ---------------------------------------------------------------------------
alter table public.matchdays
add column if not exists kickoff_at timestamptz;

alter table public.matchdays
add column if not exists goals_count_as_points boolean;

update public.matchdays
set goals_count_as_points = coalesce(goals_count_as_points, false);

alter table public.matchdays
alter column goals_count_as_points set default false;

-- ---------------------------------------------------------------------------
-- Match rows: score entry fields
-- ---------------------------------------------------------------------------
alter table public.matchday_matches
add column if not exists home_team_code text;

alter table public.matchday_matches
add column if not exists away_team_code text;

alter table public.matchday_matches
add column if not exists home_score integer;

alter table public.matchday_matches
add column if not exists away_score integer;

-- ---------------------------------------------------------------------------
-- Player stats: attendance + goalkeeper + clean sheet tracking
-- ---------------------------------------------------------------------------
alter table public.matchday_player_stats
add column if not exists attendance_status text;

alter table public.matchday_player_stats
add column if not exists goal_keeps integer;

alter table public.matchday_player_stats
add column if not exists clean_sheet boolean;

update public.matchday_player_stats
set
  attendance_status = coalesce(
    attendance_status,
    case when attended then 'in' else 'out' end
  ),
  goal_keeps = coalesce(goal_keeps, 0),
  clean_sheet = coalesce(clean_sheet, false);

alter table public.matchday_player_stats
alter column attendance_status set default 'out';

alter table public.matchday_player_stats
alter column goal_keeps set default 0;

alter table public.matchday_player_stats
alter column clean_sheet set default false;

-- ---------------------------------------------------------------------------
-- Indexes required by current upserts / lookups
-- ---------------------------------------------------------------------------
create unique index if not exists season_players_unique_idx
on public.season_players (season_id, player_id);

create unique index if not exists matchdays_unique_number_idx
on public.matchdays (season_id, matchday_number);

create unique index if not exists matchday_matches_unique_slot_idx
on public.matchday_matches (matchday_id, round_number, match_order);

create unique index if not exists matchday_player_stats_unique_idx
on public.matchday_player_stats (matchday_id, player_id);

create unique index if not exists matchday_assignments_unique_player_idx
on public.matchday_assignments (matchday_id, player_id);

create index if not exists matchdays_season_idx
on public.matchdays (season_id, matchday_number);

create index if not exists matchdays_kickoff_idx
on public.matchdays (kickoff_at);

create index if not exists matchday_player_stats_matchday_idx
on public.matchday_player_stats (matchday_id, attended);

create index if not exists matchday_player_stats_status_idx
on public.matchday_player_stats (matchday_id, attendance_status);

create index if not exists matchday_assignments_matchday_idx
on public.matchday_assignments (matchday_id, team_code);

-- ---------------------------------------------------------------------------
-- Cross-table integrity: matchday players must belong to the season roster
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Current tier views used by tier pages / matchday priority
-- ---------------------------------------------------------------------------
create or replace view public.v_season_tier_scores as
with completed_matchdays as (
  select
    md.id,
    md.season_id,
    md.matchday_number
  from public.matchdays md
  join public.seasons s
    on s.id = md.season_id
  left join public.matchday_matches mm
    on mm.matchday_id = md.id
  group by md.id, md.season_id, md.matchday_number, s.model_start_matchday
  having md.matchday_number >= coalesce(s.model_start_matchday, 1)
     and count(*) filter (
       where mm.round_number in (1, 2)
         and mm.match_order in (1, 2)
     ) = 4
     and count(*) filter (
       where mm.round_number in (1, 2)
         and mm.match_order in (1, 2)
         and mm.home_score is not null
         and mm.away_score is not null
     ) = 4
),
stats_with_status as (
  select
    cmd.id as matchday_id,
    cmd.season_id,
    cmd.matchday_number,
    mps.player_id,
    case
      when coalesce(mps.attendance_status, 'out') = 'out' and mps.attended then 'in'
      when coalesce(mps.attendance_status, 'out') = 'attended' then 'in'
      else coalesce(mps.attendance_status, 'out')
    end as effective_attendance_status
  from completed_matchdays cmd
  join public.matchday_player_stats mps
    on mps.matchday_id = cmd.id
),
season_attendance as (
  select
    sws.season_id,
    sws.player_id,
    count(*) filter (where sws.effective_attendance_status = 'in') as games_attended,
    count(*) filter (where sws.effective_attendance_status = 'available') as games_available,
    count(*) filter (where sws.effective_attendance_status = 'late_cancel') as late_cancels,
    count(*) filter (where sws.effective_attendance_status = 'no_show') as no_shows
  from stats_with_status sws
  group by sws.season_id, sws.player_id
),
recent_matchdays as (
  select
    cmd.id,
    cmd.season_id,
    row_number() over (
      partition by cmd.season_id
      order by cmd.matchday_number desc
    ) as recent_rank
  from completed_matchdays cmd
),
recent_attendance as (
  select
    rm.season_id,
    sws.player_id,
    count(*) filter (where sws.effective_attendance_status = 'in') as recent_games_attended,
    count(*) filter (where sws.effective_attendance_status = 'available') as recent_games_available,
    count(*) filter (where sws.effective_attendance_status = 'late_cancel') as recent_late_cancels,
    count(*) filter (where sws.effective_attendance_status = 'no_show') as recent_no_shows
  from recent_matchdays rm
  join stats_with_status sws
    on sws.matchday_id = rm.id
  where rm.recent_rank <= 8
  group by rm.season_id, sws.player_id
),
base as (
  select
    sp.id as season_player_id,
    sp.season_id,
    sp.player_id,
    sp.tier_status,
    coalesce(p.desired_tier, p.status) as default_status,
    coalesce(sa.games_attended, 0) as games_attended,
    coalesce(sa.games_available, 0) as games_available,
    coalesce(sa.late_cancels, 0) as late_cancels,
    coalesce(sa.no_shows, 0) as no_shows,
    ((coalesce(sa.games_attended, 0) * 2) + coalesce(sa.games_available, 0) - coalesce(sa.late_cancels, 0) - (coalesce(sa.no_shows, 0) * 2)) as attendance_score,
    coalesce(ra.recent_games_attended, 0) as recent_games_attended,
    coalesce(ra.recent_games_available, 0) as recent_games_available,
    coalesce(ra.recent_late_cancels, 0) as recent_late_cancels,
    coalesce(ra.recent_no_shows, 0) as recent_no_shows,
    ((coalesce(ra.recent_games_attended, 0) * 2) + coalesce(ra.recent_games_available, 0) - coalesce(ra.recent_late_cancels, 0) - (coalesce(ra.recent_no_shows, 0) * 2)) as recent_attendance_score,
    sp.tier_reason,
    sp.movement_note,
    sp.is_eligible,
    sp.created_at,
    sp.updated_at
  from public.season_players sp
  join public.players p
    on p.id = sp.player_id
  left join season_attendance sa
    on sa.season_id = sp.season_id
   and sa.player_id = sp.player_id
  left join recent_attendance ra
    on ra.season_id = sp.season_id
   and ra.player_id = sp.player_id
),
scored as (
  select
    base.*,
    case
      when not base.is_eligible then 'sub'
      -- FIX: Suggested tier now leans on the last 8 tracked matchdays, with season totals
      -- acting as guardrails so one short hot streak does not overwhelm the full season.
      when base.recent_attendance_score >= 7
        and base.recent_games_attended >= 3
        and base.recent_no_shows = 0
        and base.attendance_score >= 8
        and base.games_attended >= 4
        and base.no_shows <= 1 then 'core'
      when base.recent_attendance_score >= 2
        and base.recent_games_attended >= 1
        and base.no_shows <= 2 then 'flex'
      else 'sub'
    end as recommended_tier_status,
    case
      when not base.is_eligible then 'down'
      when base.recent_attendance_score >= 7
        and base.recent_games_attended >= 3
        and base.recent_no_shows = 0
        and base.attendance_score >= 8
        and base.games_attended >= 4
        and base.no_shows <= 1 then
        case
          when coalesce(base.tier_status, 'sub') = 'core' then 'steady'
          else 'up'
        end
      when base.recent_attendance_score >= 2
        and base.recent_games_attended >= 1
        and base.no_shows <= 2 then
        case
          when coalesce(base.tier_status, 'sub') = 'core' then 'down'
          when coalesce(base.tier_status, 'sub') = 'flex' then 'steady'
          else 'up'
        end
      else
        case
          when coalesce(base.tier_status, 'sub') = 'sub' then 'steady'
          else 'down'
        end
    end as trend
  from base
)
select
  scored.*,
  case
    when not scored.is_eligible then 'Ineligible. Restore eligibility before tier movement.'
    when scored.recommended_tier_status = 'core' and coalesce(scored.tier_status, 'sub') <> 'core' then 'Promotion case. The last 8 matchdays look core-level, and the season totals still clear the guardrails.'
    when scored.recommended_tier_status = 'flex' and coalesce(scored.tier_status, 'sub') = 'sub' then 'Trending up. The recent 8-match run now supports rotation minutes.'
    when scored.recommended_tier_status = 'sub' and coalesce(scored.tier_status, 'sub') <> 'sub' then 'Recent form has slipped below the current tier range, even with season totals included.'
    else coalesce(scored.movement_note, 'Stable in current tier range.')
  end as transparency_note,
  case
    when not scored.is_eligible then 'Restore eligibility'
    when scored.recommended_tier_status = 'core' then 'Keep the recent run strong and avoid no-shows'
    when scored.recommended_tier_status = 'flex' and scored.recent_games_attended < 3 then 'Turn the recent run into a longer stretch of availability'
    when scored.recommended_tier_status = 'flex' then 'Keep stacking recent attendance and push toward core'
    else 'Build a stronger recent 8-match run and reduce late changes'
  end as next_step
from scored;

create or replace view public.v_season_tier_transparency as
select
  v.season_id,
  s.name as season_name,
  s.model_start_matchday,
  v.player_id,
  p.first_name,
  p.last_name,
  p.nickname,
  p.nationality,
  v.default_status,
  v.tier_status,
  v.recommended_tier_status,
  v.games_attended,
  v.games_available,
  v.late_cancels,
  v.no_shows,
  v.attendance_score,
  v.recent_games_attended,
  v.recent_games_available,
  v.recent_late_cancels,
  v.recent_no_shows,
  v.recent_attendance_score,
  v.is_eligible,
  v.tier_reason,
  v.movement_note,
  v.transparency_note,
  v.next_step,
  v.trend,
  v.created_at,
  v.updated_at
from public.v_season_tier_scores v
join public.players p
  on p.id = v.player_id
join public.seasons s
  on s.id = v.season_id;

create or replace view public.v_rotation_priority as
select
  vt.season_id,
  vt.season_name,
  vt.model_start_matchday,
  vt.player_id,
  vt.first_name,
  vt.last_name,
  vt.nickname,
  vt.nationality,
  vt.default_status,
  vt.tier_status,
  vt.recommended_tier_status,
  vt.games_attended,
  vt.games_available,
  vt.late_cancels,
  vt.no_shows,
  vt.attendance_score,
  vt.recent_games_attended,
  vt.recent_games_available,
  vt.recent_late_cancels,
  vt.recent_no_shows,
  vt.recent_attendance_score,
  vt.is_eligible,
  vt.tier_reason,
  vt.movement_note,
  vt.transparency_note,
  vt.next_step,
  vt.trend,
  row_number() over (
    partition by vt.season_id
    order by vt.games_attended asc, vt.attendance_score desc, vt.no_shows asc, lower(trim(vt.last_name)), lower(trim(vt.first_name))
  ) as rotation_priority_rank
from public.v_season_tier_transparency vt
where vt.tier_status = 'flex'
  and vt.is_eligible = true;

-- ---------------------------------------------------------------------------
-- Remove legacy table if it still exists
-- ---------------------------------------------------------------------------
drop table if exists public.matchday_team_scores cascade;

commit;

-- Final verification query so Supabase SQL Editor has a safe SELECT result to return.
select
  to_regclass('public.v_season_tier_scores') is not null as v_season_tier_scores_ready,
  to_regclass('public.v_season_tier_transparency') is not null as v_season_tier_transparency_ready,
  to_regclass('public.v_rotation_priority') is not null as v_rotation_priority_ready,
  to_regclass('public.matchday_team_scores') is null as legacy_matchday_team_scores_removed;
