select
  to_regclass('public.players') is not null as players_ready,
  to_regclass('public.seasons') is not null as seasons_ready,
  to_regclass('public.season_players') is not null as season_players_ready,
  to_regclass('public.matchdays') is not null as matchdays_ready,
  to_regclass('public.matchday_matches') is not null as matchday_matches_ready,
  to_regclass('public.matchday_player_stats') is not null as matchday_player_stats_ready,
  to_regclass('public.matchday_assignments') is not null as matchday_assignments_ready,
  to_regclass('public.v_season_tier_scores') is not null as v_season_tier_scores_ready,
  to_regclass('public.v_season_tier_transparency') is not null as v_season_tier_transparency_ready,
  to_regclass('public.v_rotation_priority') is not null as v_rotation_priority_ready;
