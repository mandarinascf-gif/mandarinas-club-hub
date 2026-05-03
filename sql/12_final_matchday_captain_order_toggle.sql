-- STEP 12: Final-matchday captain order toggle.
-- Run this after sql/11_matchday_team_captains.sql on existing projects.

begin;

alter table public.matchdays
  add column if not exists final_captain_order_enabled boolean;

update public.matchdays
set final_captain_order_enabled = true
where final_captain_order_enabled is null;

alter table public.matchdays
  alter column final_captain_order_enabled set default true,
  alter column final_captain_order_enabled set not null;

commit;
