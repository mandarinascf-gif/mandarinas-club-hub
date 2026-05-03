begin;

drop table if exists public.admin_allowed_emails cascade;
drop table if exists public.player_accounts cascade;
drop function if exists public.is_admin() cascade;

drop policy if exists "Anyone can read players" on public.players;
drop policy if exists "Anyone can add players" on public.players;
drop policy if exists "Admins can add players" on public.players;
drop policy if exists "Anyone can update players" on public.players;
drop policy if exists "Admins can update players" on public.players;
drop policy if exists "Anyone can delete players" on public.players;
drop policy if exists "Admins can delete players" on public.players;

create policy "Anyone can read players"
on public.players
for select
to anon, authenticated
using (true);

create policy "Anyone can add players"
on public.players
for insert
to anon, authenticated
with check (true);

create policy "Anyone can update players"
on public.players
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete players"
on public.players
for delete
to anon, authenticated
using (true);

drop policy if exists "Anyone can read seasons" on public.seasons;
drop policy if exists "Anyone can add seasons" on public.seasons;
drop policy if exists "Admins can add seasons" on public.seasons;
drop policy if exists "Anyone can update seasons" on public.seasons;
drop policy if exists "Admins can update seasons" on public.seasons;
drop policy if exists "Anyone can delete seasons" on public.seasons;
drop policy if exists "Admins can delete seasons" on public.seasons;

create policy "Anyone can read seasons"
on public.seasons
for select
to anon, authenticated
using (true);

create policy "Anyone can add seasons"
on public.seasons
for insert
to anon, authenticated
with check (true);

create policy "Anyone can update seasons"
on public.seasons
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete seasons"
on public.seasons
for delete
to anon, authenticated
using (true);

drop policy if exists "Anyone can read season players" on public.season_players;
drop policy if exists "Anyone can add season players" on public.season_players;
drop policy if exists "Admins can add season players" on public.season_players;
drop policy if exists "Anyone can update season players" on public.season_players;
drop policy if exists "Admins can update season players" on public.season_players;
drop policy if exists "Anyone can delete season players" on public.season_players;
drop policy if exists "Admins can delete season players" on public.season_players;

create policy "Anyone can read season players"
on public.season_players
for select
to anon, authenticated
using (true);

create policy "Anyone can add season players"
on public.season_players
for insert
to anon, authenticated
with check (true);

create policy "Anyone can update season players"
on public.season_players
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete season players"
on public.season_players
for delete
to anon, authenticated
using (true);

drop policy if exists "Anyone can read season roster requests" on public.season_roster_requests;
drop policy if exists "Anyone can add season roster requests" on public.season_roster_requests;
drop policy if exists "Anyone can update season roster requests" on public.season_roster_requests;
drop policy if exists "Admins can update season roster requests" on public.season_roster_requests;
drop policy if exists "Anyone can delete season roster requests" on public.season_roster_requests;
drop policy if exists "Admins can delete season roster requests" on public.season_roster_requests;

create policy "Anyone can read season roster requests"
on public.season_roster_requests
for select
to anon, authenticated
using (true);

create policy "Anyone can add season roster requests"
on public.season_roster_requests
for insert
to anon, authenticated
with check (true);

create policy "Anyone can update season roster requests"
on public.season_roster_requests
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete season roster requests"
on public.season_roster_requests
for delete
to anon, authenticated
using (true);

drop policy if exists "Anyone can read matchdays" on public.matchdays;
drop policy if exists "Anyone can add matchdays" on public.matchdays;
drop policy if exists "Admins can add matchdays" on public.matchdays;
drop policy if exists "Anyone can update matchdays" on public.matchdays;
drop policy if exists "Admins can update matchdays" on public.matchdays;
drop policy if exists "Anyone can delete matchdays" on public.matchdays;
drop policy if exists "Admins can delete matchdays" on public.matchdays;

create policy "Anyone can read matchdays"
on public.matchdays
for select
to anon, authenticated
using (true);

create policy "Anyone can add matchdays"
on public.matchdays
for insert
to anon, authenticated
with check (true);

create policy "Anyone can update matchdays"
on public.matchdays
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete matchdays"
on public.matchdays
for delete
to anon, authenticated
using (true);

drop policy if exists "Anyone can read matchday matches" on public.matchday_matches;
drop policy if exists "Anyone can add matchday matches" on public.matchday_matches;
drop policy if exists "Admins can add matchday matches" on public.matchday_matches;
drop policy if exists "Anyone can update matchday matches" on public.matchday_matches;
drop policy if exists "Admins can update matchday matches" on public.matchday_matches;
drop policy if exists "Anyone can delete matchday matches" on public.matchday_matches;
drop policy if exists "Admins can delete matchday matches" on public.matchday_matches;

create policy "Anyone can read matchday matches"
on public.matchday_matches
for select
to anon, authenticated
using (true);

create policy "Anyone can add matchday matches"
on public.matchday_matches
for insert
to anon, authenticated
with check (true);

create policy "Anyone can update matchday matches"
on public.matchday_matches
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete matchday matches"
on public.matchday_matches
for delete
to anon, authenticated
using (true);

drop policy if exists "Anyone can read matchday player stats" on public.matchday_player_stats;
drop policy if exists "Anyone can add matchday player stats" on public.matchday_player_stats;
drop policy if exists "Admins can add matchday player stats" on public.matchday_player_stats;
drop policy if exists "Anyone can update matchday player stats" on public.matchday_player_stats;
drop policy if exists "Admins can update matchday player stats" on public.matchday_player_stats;
drop policy if exists "Anyone can delete matchday player stats" on public.matchday_player_stats;
drop policy if exists "Admins can delete matchday player stats" on public.matchday_player_stats;

create policy "Anyone can read matchday player stats"
on public.matchday_player_stats
for select
to anon, authenticated
using (true);

create policy "Anyone can add matchday player stats"
on public.matchday_player_stats
for insert
to anon, authenticated
with check (true);

create policy "Anyone can update matchday player stats"
on public.matchday_player_stats
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete matchday player stats"
on public.matchday_player_stats
for delete
to anon, authenticated
using (true);

drop policy if exists "Anyone can read matchday assignments" on public.matchday_assignments;
drop policy if exists "Anyone can add matchday assignments" on public.matchday_assignments;
drop policy if exists "Admins can add matchday assignments" on public.matchday_assignments;
drop policy if exists "Anyone can update matchday assignments" on public.matchday_assignments;
drop policy if exists "Admins can update matchday assignments" on public.matchday_assignments;
drop policy if exists "Anyone can delete matchday assignments" on public.matchday_assignments;
drop policy if exists "Admins can delete matchday assignments" on public.matchday_assignments;

create policy "Anyone can read matchday assignments"
on public.matchday_assignments
for select
to anon, authenticated
using (true);

create policy "Anyone can add matchday assignments"
on public.matchday_assignments
for insert
to anon, authenticated
with check (true);

create policy "Anyone can update matchday assignments"
on public.matchday_assignments
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete matchday assignments"
on public.matchday_assignments
for delete
to anon, authenticated
using (true);

do $$
begin
  if to_regclass('public.matchday_team_captains') is not null then
    execute 'drop policy if exists "Anyone can read matchday team captains" on public.matchday_team_captains';
    execute 'drop policy if exists "Anyone can add matchday team captains" on public.matchday_team_captains';
    execute 'drop policy if exists "Admins can add matchday team captains" on public.matchday_team_captains';
    execute 'drop policy if exists "Anyone can update matchday team captains" on public.matchday_team_captains';
    execute 'drop policy if exists "Admins can update matchday team captains" on public.matchday_team_captains';
    execute 'drop policy if exists "Anyone can delete matchday team captains" on public.matchday_team_captains';
    execute 'drop policy if exists "Admins can delete matchday team captains" on public.matchday_team_captains';

    execute '
      create policy "Anyone can read matchday team captains"
      on public.matchday_team_captains
      for select
      to anon, authenticated
      using (true)
    ';

    execute '
      create policy "Anyone can add matchday team captains"
      on public.matchday_team_captains
      for insert
      to anon, authenticated
      with check (true)
    ';

    execute '
      create policy "Anyone can update matchday team captains"
      on public.matchday_team_captains
      for update
      to anon, authenticated
      using (true)
      with check (true)
    ';

    execute '
      create policy "Anyone can delete matchday team captains"
      on public.matchday_team_captains
      for delete
      to anon, authenticated
      using (true)
    ';
  end if;
end
$$;

commit;

select 'code_gate_reverted' as status;
