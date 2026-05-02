-- PART 2: Views
-- Run this AFTER supabase_setup_part1.sql has completed successfully.
-- If Supabase SQL Editor shows `relation "a" does not exist`, switch the results mode
-- from `Limit 100` to `No limit`, then rerun the script.

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

-- Verification moved to sql/setup_verification.sql to avoid Supabase SQL Editor
-- result-wrapper bugs when running setup scripts with row limits enabled.
