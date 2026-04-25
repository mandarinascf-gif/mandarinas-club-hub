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
where vt.tier_status = 'rotation'
  and vt.is_eligible = true;
