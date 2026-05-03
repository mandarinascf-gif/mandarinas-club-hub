-- Incremental upgrade: link Busses access emails to player records and expose them to admins.
-- Run this after sql/13_admin_magic_link_allowlist.sql on a live project.

begin;

alter table public.admin_allowed_emails
add column if not exists player_id bigint references public.players(id) on delete set null;

drop index if exists public.admin_allowed_emails_player_key;
create unique index admin_allowed_emails_player_key
on public.admin_allowed_emails (player_id);

revoke all on public.admin_allowed_emails from anon;
revoke all on public.admin_allowed_emails from authenticated;
grant select, insert, update, delete on public.admin_allowed_emails to authenticated;

drop policy if exists "Admins can read admin emails" on public.admin_allowed_emails;
create policy "Admins can read admin emails"
on public.admin_allowed_emails
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can add admin emails" on public.admin_allowed_emails;
create policy "Admins can add admin emails"
on public.admin_allowed_emails
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update admin emails" on public.admin_allowed_emails;
create policy "Admins can update admin emails"
on public.admin_allowed_emails
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete admin emails" on public.admin_allowed_emails;
create policy "Admins can delete admin emails"
on public.admin_allowed_emails
for delete
to authenticated
using (public.is_admin());

commit;
