-- Summer 2026 tier seed from confirmed club mapping.
-- Run this AFTER sql/09_rename_tier_statuses.sql so the canonical
-- values core/flex/sub are accepted in production.
--
-- What this does:
-- 1. Creates Fernando Santos if he does not already exist.
-- 2. Resets all player default tiers to sub.
-- 3. Promotes the confirmed 31 core and 10 flex players.
-- 4. Resets the Summer 2026 season roster to sub.
-- 5. Promotes the same 41 players on the Summer 2026 roster and inserts
--    any missing season_players rows for them.
--
-- What this does NOT do:
-- - It does not delete non-target players from Summer 2026.
-- - It does not rename existing player records.

begin;

insert into public.players (
  first_name,
  last_name,
  nationality,
  positions,
  desired_tier,
  status,
  dominant_foot
)
select
  'Fernando',
  'Santos',
  'Unknown',
  array['MID']::text[],
  'core',
  'core',
  'right'
where not exists (
  select 1
  from public.players
  where lower(trim(first_name)) = 'fernando'
    and lower(trim(last_name)) = 'santos'
);

do $$
declare
  fernando_santos_count integer;
begin
  select count(*)
  into fernando_santos_count
  from public.players
  where lower(trim(first_name)) = 'fernando'
    and lower(trim(last_name)) = 'santos';

  if fernando_santos_count <> 1 then
    raise exception
      'Expected exactly 1 Fernando Santos row after insert, found %',
      fernando_santos_count;
  end if;
end $$;

create temp table tmp_summer_2026_targets (
  player_id bigint primary key,
  expected_first_name text not null,
  expected_last_name text not null,
  tier text not null check (tier in ('core', 'flex')),
  source_label text not null
) on commit drop;

insert into tmp_summer_2026_targets (
  player_id,
  expected_first_name,
  expected_last_name,
  tier,
  source_label
)
select
  id,
  'Fernando',
  'Santos',
  'core',
  'Fernando'
from public.players
where lower(trim(first_name)) = 'fernando'
  and lower(trim(last_name)) = 'santos';

insert into tmp_summer_2026_targets (
  player_id,
  expected_first_name,
  expected_last_name,
  tier,
  source_label
)
values
  (301, 'Min', 'Kim', 'core', 'Min Kim'),
  (302, 'Luis', 'Marroquin', 'core', 'Luis Marroquin'),
  (287, 'Miguel', 'Player', 'core', 'Miguel A'),
  (241, 'Oscar', 'Rosales', 'core', 'Oscar G. / Pirlo'),
  (247, 'Sergio', 'Player', 'core', 'Sergio'),
  (234, 'Jesus', 'David', 'core', 'Jesus'),
  (285, 'Rudy', 'Ramirez', 'core', 'Rudy Ramirez'),
  (257, 'Ruben', 'Player', 'core', 'Ruben''s'),
  (242, 'Victor', 'Nizama', 'core', 'Victor N'),
  (296, 'Axel', 'Aguilera', 'core', 'Axel Aguilera'),
  (255, 'Michael', 'Enriquez', 'core', 'Mikey Enriquez'),
  (279, 'Walter', 'Acero', 'core', 'Walter Acero'),
  (240, 'Jose', 'Sarza', 'core', 'Jose sarza'),
  (270, 'Rodrigo', 'Mena', 'core', 'Rodrigo Mena'),
  (248, 'Carlos', 'Silva', 'core', 'CarlosS'),
  (281, 'Asdruval', 'Villanueva', 'core', 'Asdruval Villanueva'),
  (272, 'José', 'Blanco', 'core', 'Jose Blanco'),
  (230, 'Crisanto', 'Valencia', 'core', 'Valencia'),
  (294, 'Luis', 'Urueta', 'core', 'Luis Javier'),
  (260, 'Gerardo', 'Mendizabal', 'core', 'Gerardo'),
  (289, 'Osmin', 'De Leon', 'core', 'Osmin DLeon'),
  (262, 'Eder', 'Martinez', 'core', 'Eder'),
  (254, 'Gabriel', 'Alava', 'core', 'Gabo Alava'),
  (231, 'Rodolfo', 'Toledo', 'core', 'toledortc'),
  (276, 'Nicky', 'Diaz', 'core', 'Nicky'),
  (283, 'Guillermo', 'Lenz', 'core', 'Guillermo'),
  (292, 'Andres', 'Aguayo', 'core', 'Andrés'),
  (278, 'Jose', 'Cerf', 'core', 'Jose Alberto C...'),
  (291, 'Alex', 'Meneses', 'core', 'Alexander Meneses'),
  (290, 'Jordan', 'Toledo', 'core', 'Jordan'),
  (243, 'Efrain', 'Jauregui', 'flex', 'Efrain'),
  (237, 'Alexis', 'Player', 'flex', 'occidental flooring'),
  (293, 'Karter', 'Player', 'flex', 'Karter DeLang'),
  (232, 'Luis Enrique', 'Martinez', 'flex', 'Luis Enrique M...'),
  (274, 'Luis', 'De La Rosa', 'flex', 'Luis'),
  (227, 'Fabian', 'Muñoz', 'flex', 'Fabian Munoz C...'),
  (284, 'Jhonatan', 'Ochoa', 'flex', 'John Oyarce / Coti'),
  (266, 'David', 'Toro', 'flex', 'David'),
  (273, 'Cesar', 'Lopez', 'flex', 'Cesar Lopez'),
  (226, 'Mike', 'Aguilar', 'flex', 'Mike Aguilar');

create temp table tmp_summer_2026_season (
  season_id bigint primary key
) on commit drop;

insert into tmp_summer_2026_season (season_id)
select id
from public.seasons
where lower(trim(name)) = lower('Summer 2026');

do $$
declare
  target_count integer;
  season_count integer;
  validation_errors text;
begin
  select count(*)
  into target_count
  from tmp_summer_2026_targets;

  if target_count <> 41 then
    raise exception 'Expected 41 mapped Summer 2026 players, found %', target_count;
  end if;

  select count(*)
  into season_count
  from tmp_summer_2026_season;

  if season_count <> 1 then
    raise exception 'Expected exactly 1 Summer 2026 season row, found %', season_count;
  end if;

  select string_agg(
    format(
      'id=%s source=%s expected=%s %s actual=%s %s',
      t.player_id,
      t.source_label,
      t.expected_first_name,
      t.expected_last_name,
      coalesce(p.first_name, '<missing>'),
      coalesce(p.last_name, '<missing>')
    ),
    '; ' order by t.player_id
  )
  into validation_errors
  from tmp_summer_2026_targets t
  left join public.players p
    on p.id = t.player_id
  where p.id is null
     or lower(trim(p.first_name)) <> lower(trim(t.expected_first_name))
     or lower(trim(p.last_name)) <> lower(trim(t.expected_last_name));

  if validation_errors is not null then
    raise exception 'Summer 2026 target validation failed: %', validation_errors;
  end if;
end $$;

update public.players
set desired_tier = 'sub',
    status = 'sub'
where desired_tier is distinct from 'sub'
   or status is distinct from 'sub';

update public.players p
set desired_tier = t.tier,
    status = t.tier
from tmp_summer_2026_targets t
where p.id = t.player_id
  and (
    p.desired_tier is distinct from t.tier
    or p.status is distinct from t.tier
  );

update public.season_players sp
set tier_status = 'sub',
    registration_tier = 'sub'
where sp.season_id = (select season_id from tmp_summer_2026_season)
  and (
    sp.tier_status is distinct from 'sub'
    or sp.registration_tier is distinct from 'sub'
  );

insert into public.season_players (
  season_id,
  player_id,
  tier_status,
  registration_tier
)
select
  s.season_id,
  t.player_id,
  t.tier,
  t.tier
from tmp_summer_2026_season s
cross join tmp_summer_2026_targets t
where not exists (
  select 1
  from public.season_players sp
  where sp.season_id = s.season_id
    and sp.player_id = t.player_id
);

update public.season_players sp
set tier_status = t.tier,
    registration_tier = t.tier
from tmp_summer_2026_targets t
where sp.season_id = (select season_id from tmp_summer_2026_season)
  and sp.player_id = t.player_id
  and (
    sp.tier_status is distinct from t.tier
    or sp.registration_tier is distinct from t.tier
  );

select
  p.status,
  p.desired_tier,
  count(*) as player_count
from public.players p
group by p.status, p.desired_tier
order by p.status, p.desired_tier;

select
  sp.tier_status,
  sp.registration_tier,
  count(*) as season_player_count
from public.season_players sp
where sp.season_id = (select season_id from tmp_summer_2026_season)
group by sp.tier_status, sp.registration_tier
order by sp.tier_status, sp.registration_tier;

select
  t.tier,
  count(*) as mapped_player_count
from tmp_summer_2026_targets t
group by t.tier
order by t.tier;

commit;
