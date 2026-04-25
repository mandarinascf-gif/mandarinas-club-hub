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
