-- Restore live delete access for season resets from Season Centre.
-- Run this in the Supabase SQL Editor on the deployed project.
-- Deleting a season row cascades into its matchdays, season roster, requests,
-- scores, stats, assignments, suggestions, and captains.

begin;

alter table public.seasons enable row level security;

drop policy if exists "Anyone can delete seasons" on public.seasons;
drop policy if exists "Admins can delete seasons" on public.seasons;

create policy "Anyone can delete seasons"
on public.seasons
for delete
to anon, authenticated
using (true);

commit;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'seasons'
  and policyname = 'Anyone can delete seasons';
