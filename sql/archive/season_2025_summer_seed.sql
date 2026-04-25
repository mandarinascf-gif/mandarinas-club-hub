-- Historical season seed generated from a Mandarinas workbook.
-- Source workbook: /Users/andresaguayo/Downloads/Copy of 2025 MANDARINAS CF CURRENT SUMMER SEASON.xlsx
-- Season name: 2025 Summer
-- Historical rules applied:
-- 1. Only the target season is deleted and recreated. Existing players stay in place.
-- 2. Buddy labels resolve to one real player per matchday. The full buddy-slot stats stay with that selected player.
-- 3. Historical imports do not assign anyone to Core. Imported players default to Rotation unless they were explicitly a sub.
-- 4. This seed is for archive/history only. Current-season live tiers still need to be managed in the app.

begin;

delete from public.seasons
where lower(trim(name)) = lower('2025 Summer');

with player_seed as (
  select *
  from (
    values
      ('Walter', 'Acero', 'Walter Acero', 'Unknown', array['MID', 'DEF', 'GK']::text[], 'flex_sub', 'flex_sub'),
      ('Andres', 'Aguayo', 'Andres', 'Ecuador', array['DEF', 'ATT', 'ATT']::text[], 'rotation', 'rotation'),
      ('Gabriel', 'Alava', 'Gabriel', 'Unknown', array['MID']::text[], 'rotation', 'rotation'),
      ('Jeff', 'Arce', 'Jeff', 'Costa Rica', array['ATT', 'MID', 'GK']::text[], 'rotation', 'rotation'),
      ('José', 'Blanco', 'Jose Blanco', 'Mexico', array['ATT', 'DEF', 'GK']::text[], 'rotation', 'rotation'),
      ('Jose', 'Cerf', 'Chato', 'Chile', array['MID', 'ATT', 'DEF']::text[], 'rotation', 'rotation'),
      ('Nicky', 'Diaz', 'Nicky', 'Peru', array['MID', 'ATT', 'DEF']::text[], 'rotation', 'rotation'),
      ('Osmin', 'Dleon', 'Osmin', 'Unknown', array['MID']::text[], 'rotation', 'rotation'),
      ('Michael', 'Enriquez', 'Mikey', 'Mexico', array['MID', 'ATT', 'DEF']::text[], 'rotation', 'rotation'),
      ('Nicolas', 'Galviz', 'Nicolás Galviz', 'Unknown', array['MID']::text[], 'flex_sub', 'flex_sub'),
      ('Efrain', 'Jauregui', 'Efra', 'Mexico', array['DEF', 'MID', 'DEF']::text[], 'rotation', 'rotation'),
      ('Eder', 'Martinez', 'Eder', 'Mexico', array['MID', 'ATT', 'GK']::text[], 'rotation', 'rotation'),
      ('Luis Enrique', 'Martinez', 'Cuñis', 'Mexico', array['DEF', 'ATT', 'GK']::text[], 'rotation', 'rotation'),
      ('Gerardo', 'Mendizabal', 'Gerardo', 'Mexico', array['MID', 'DEF', 'ATT']::text[], 'rotation', 'rotation'),
      ('Alex', 'Meneses', 'Alex', 'Peru', array['MID', 'DEF', 'ATT']::text[], 'rotation', 'rotation'),
      ('Fabian', 'Munoz', 'Fabian', 'Mexico', array['GK', 'DEF', 'MID']::text[], 'rotation', 'rotation'),
      ('Victor', 'Nizama', 'Victor N', 'Unknown', array['MID']::text[], 'rotation', 'rotation'),
      ('Alexis', 'Player', 'Alexis', 'Mexico', array['MID']::text[], 'rotation', 'rotation'),
      ('Chavito', 'Player', 'Chavito', 'Mexico', array['DEF', 'MID', 'GK']::text[], 'rotation', 'rotation'),
      ('Chilas', 'Player', 'Chilas', 'Unknown', array['MID']::text[], 'rotation', 'rotation'),
      ('Chris', 'Player', 'Chris', 'Unknown', array['MID']::text[], 'rotation', 'rotation'),
      ('Coti', 'Player', 'Coti', 'Peru', array['DEF', 'GK', 'DEF']::text[], 'rotation', 'rotation'),
      ('Emilio', 'Player', 'Emilio', 'Unknown', array['MID']::text[], 'flex_sub', 'flex_sub'),
      ('Enerson', 'Player', 'Enerson', 'Unknown', array['MID']::text[], 'rotation', 'rotation'),
      ('Fer', 'Player', 'Fer', 'Mexico', array['GK', 'GK', 'GK']::text[], 'rotation', 'rotation'),
      ('Gus', 'Player', 'Gus', 'El Salvador', array['ATT', 'DEF', 'MID']::text[], 'rotation', 'rotation'),
      ('Jhonatan', 'Player', 'Jhonatan A', 'Unknown', array['MID']::text[], 'flex_sub', 'flex_sub'),
      ('Karter', 'Player', 'Karter', 'USA', array['MID']::text[], 'flex_sub', 'flex_sub'),
      ('Kevin', 'Player', 'Kevin', 'El Salvador', array['ATT', 'DEF', 'MID']::text[], 'rotation', 'rotation'),
      ('López', 'Player', 'Lopez', 'Mexico', array['DEF', 'GK', 'DEF']::text[], 'rotation', 'rotation'),
      ('Mike', 'Player', 'Mike', 'El Salvador', array['DEF', 'GK', 'MID']::text[], 'rotation', 'rotation'),
      ('Netto', 'Player', 'Netto', 'Unknown', array['MID']::text[], 'rotation', 'rotation'),
      ('Rob', 'Player', 'Rob', 'El Salvador', array['DEF', 'GK', 'DEF']::text[], 'rotation', 'rotation'),
      ('Rodrigo', 'Player', 'Rodrigo', 'Nicaragua', array['MID', 'DEF', 'GK']::text[], 'rotation', 'rotation'),
      ('Rubén', 'Player', 'Ruben', 'Peru', array['ATT', 'MID', 'DEF']::text[], 'rotation', 'rotation'),
      ('Valverde', 'Player', 'Valverde', 'Mexico', array['ATT', 'MID', 'ATT']::text[], 'rotation', 'rotation'),
      ('Rudy', 'Ramirez', 'Rudy', 'Unknown', array['MID', 'DEF', 'ATT']::text[], 'rotation', 'rotation'),
      ('Oscar', 'Rosales', 'Pirlo', 'El Salvador', array['MID', 'MID', 'MID']::text[], 'rotation', 'rotation'),
      ('Jhony', 'Sanchez', 'Jhony S', 'Mexico', array['MID', 'ATT', 'DEF']::text[], 'rotation', 'rotation'),
      ('Jose', 'Sarza', 'Jose Sarza', 'Mexico', array['DEF', 'DEF', 'DEF']::text[], 'rotation', 'rotation'),
      ('Carlos', 'Silva', 'Carlos S.', 'Peru', array['MID', 'ATT', 'DEF']::text[], 'rotation', 'rotation'),
      ('Jordan', 'Toledo', 'Jordan', 'Mexico', array['DEF', 'MID', 'ATT']::text[], 'rotation', 'rotation'),
      ('Rodolfo', 'Toledo', 'Rodolfo', 'Mexico', array['GK', 'DEF', 'MID']::text[], 'rotation', 'rotation'),
      ('David', 'Toro', 'David', 'Ecuador', array['MID', 'MID', 'MID']::text[], 'rotation', 'rotation'),
      ('Luis', 'Urueta', 'Javier', 'Mexico', array['ATT', 'DEF', 'ATT']::text[], 'rotation', 'rotation'),
      ('Crisanto', 'Valencia', 'Valencia', 'Mexico', array['MID', 'ATT', 'DEF']::text[], 'rotation', 'rotation'),
      ('Juan Pablo', 'Valladares', 'Juan Pablo', 'Unknown', array['MID']::text[], 'flex_sub', 'flex_sub'),
      ('Asdruval', 'Villanueva', 'Asdruval', 'Mexico', array['DEF', 'ATT', 'GK']::text[], 'rotation', 'rotation')
  ) as seed(first_name, last_name, nickname, nationality, positions, desired_tier, status)
)
insert into public.players (
  first_name,
  last_name,
  nickname,
  nationality,
  positions,
  desired_tier,
  status
)
select
  player_seed.first_name,
  player_seed.last_name,
  player_seed.nickname,
  player_seed.nationality,
  player_seed.positions,
  player_seed.desired_tier,
  player_seed.status
from player_seed
where not exists (
  select 1
  from public.players p
  where lower(trim(p.first_name)) = lower(trim(player_seed.first_name))
    and lower(trim(p.last_name)) = lower(trim(player_seed.last_name))
);

insert into public.seasons (
  name,
  total_matchdays,
  core_spots,
  rotation_spots,
  model_start_matchday,
  attendance_points,
  win_points,
  draw_points,
  loss_points,
  goal_keep_points,
  team_goal_points
)
values (
  '2025 Summer',
  8,
  0,
  48,
  1,
  2,
  2,
  1,
  0,
  1,
  1
);

with season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower('2025 Summer')
),
matchday_seed as (
  select *
  from (
    values
      (1, timestamptz '2025-05-01 12:00:00 America/Los_Angeles', false),
      (2, timestamptz '2025-05-08 12:00:00 America/Los_Angeles', false),
      (3, timestamptz '2025-05-15 12:00:00 America/Los_Angeles', false),
      (4, timestamptz '2025-05-22 12:00:00 America/Los_Angeles', false),
      (5, timestamptz '2025-05-29 12:00:00 America/Los_Angeles', true),
      (6, timestamptz '2025-06-05 12:00:00 America/Los_Angeles', true),
      (7, timestamptz '2025-06-12 12:00:00 America/Los_Angeles', true),
      (8, timestamptz '2025-06-26 12:00:00 America/Los_Angeles', true)
  ) as seed(matchday_number, kickoff_at, goals_count_as_points)
)
insert into public.matchdays (season_id, matchday_number, kickoff_at, goals_count_as_points)
select
  season_row.id,
  matchday_seed.matchday_number,
  matchday_seed.kickoff_at,
  matchday_seed.goals_count_as_points
from season_row
cross join matchday_seed;

with season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower('2025 Summer')
),
matchday_lookup as (
  select md.id, md.matchday_number
  from public.matchdays md
  join season_row on season_row.id = md.season_id
),
match_seed as (
  select *
  from (
    values
      (1, 1, 1, 'blue', 'magenta', 4, 0),
      (1, 1, 2, 'green', 'orange', 3, 0),
      (1, 2, 1, 'blue', 'green', 2, 0),
      (1, 2, 2, 'orange', 'magenta', 1, 1),
      (2, 1, 1, 'blue', 'magenta', 1, 1),
      (2, 1, 2, 'green', 'orange', 2, 1),
      (2, 2, 1, 'orange', 'magenta', 0, 0),
      (2, 2, 2, 'blue', 'green', 1, 0),
      (3, 1, 1, 'blue', 'magenta', 3, 0),
      (3, 1, 2, 'orange', 'green', 0, 1),
      (3, 2, 1, 'blue', 'green', 0, 1),
      (3, 2, 2, 'magenta', 'orange', 2, 1),
      (4, 1, 1, 'blue', 'magenta', 3, 1),
      (4, 1, 2, 'green', 'orange', 2, 1),
      (4, 2, 1, 'blue', 'green', 1, 3),
      (4, 2, 2, 'orange', 'magenta', 1, 4),
      (5, 1, 1, null, null, null, null),
      (5, 1, 2, null, null, null, null),
      (5, 2, 1, null, null, null, null),
      (5, 2, 2, null, null, null, null),
      (6, 1, 1, null, null, null, null),
      (6, 1, 2, null, null, null, null),
      (6, 2, 1, null, null, null, null),
      (6, 2, 2, null, null, null, null),
      (7, 1, 1, null, null, null, null),
      (7, 1, 2, null, null, null, null),
      (7, 2, 1, null, null, null, null),
      (7, 2, 2, null, null, null, null),
      (8, 1, 1, null, null, null, null),
      (8, 1, 2, null, null, null, null),
      (8, 2, 1, null, null, null, null),
      (8, 2, 2, null, null, null, null)
  ) as seed(matchday_number, round_number, match_order, home_team_code, away_team_code, home_score, away_score)
)
insert into public.matchday_matches (
  matchday_id,
  round_number,
  match_order,
  home_team_code,
  away_team_code,
  home_score,
  away_score
)
select
  matchday_lookup.id,
  match_seed.round_number,
  match_seed.match_order,
  match_seed.home_team_code,
  match_seed.away_team_code,
  match_seed.home_score,
  match_seed.away_score
from match_seed
join matchday_lookup
  on matchday_lookup.matchday_number = match_seed.matchday_number;

with player_aliases as (
  select *
  from (
    values
      ('ALEX', 'Alex', 'Meneses'),
      ('ALEXIS', 'Alexis', 'Player'),
      ('ANDRES', 'Andres', 'Aguayo'),
      ('ASDRUVAL', 'Asdruval', 'Villanueva'),
      ('CARLOS S.', 'Carlos', 'Silva'),
      ('CHATO', 'Jose', 'Cerf'),
      ('CHAVITO', 'Chavito', 'Player'),
      ('CHILAS', 'Chilas', 'Player'),
      ('CHRIS', 'Chris', 'Player'),
      ('COTI', 'Coti', 'Player'),
      ('CUÑIS', 'Luis Enrique', 'Martinez'),
      ('DAVID', 'David', 'Toro'),
      ('EDER', 'Eder', 'Martinez'),
      ('EFRA', 'Efrain', 'Jauregui'),
      ('EMILIO', 'Emilio', 'Player'),
      ('ENERSON', 'Enerson', 'Player'),
      ('FABIAN', 'Fabian', 'Munoz'),
      ('FER', 'Fer', 'Player'),
      ('GABRIEL', 'Gabriel', 'Alava'),
      ('GERARDO', 'Gerardo', 'Mendizabal'),
      ('GUS', 'Gus', 'Player'),
      ('JAVIER', 'Luis', 'Urueta'),
      ('JEFF', 'Jeff', 'Arce'),
      ('JHONATAN A', 'Jhonatan', 'Player'),
      ('JHONY S', 'Jhony', 'Sanchez'),
      ('JORDAN', 'Jordan', 'Toledo'),
      ('JOSE BLANCO', 'José', 'Blanco'),
      ('JOSE SARZA', 'Jose', 'Sarza'),
      ('JUAN PABLO', 'Juan Pablo', 'Valladares'),
      ('KARTER', 'Karter', 'Player'),
      ('KEVIN', 'Kevin', 'Player'),
      ('LOPEZ', 'López', 'Player'),
      ('MIKE', 'Mike', 'Player'),
      ('MIKEY', 'Michael', 'Enriquez'),
      ('NETTO', 'Netto', 'Player'),
      ('NICKY', 'Nicky', 'Diaz'),
      ('NICOLÁS GALVIZ', 'Nicolas', 'Galviz'),
      ('OSMIN', 'Osmin', 'Dleon'),
      ('PIRLO', 'Oscar', 'Rosales'),
      ('ROB', 'Rob', 'Player'),
      ('RODOLFO', 'Rodolfo', 'Toledo'),
      ('RODRIGO', 'Rodrigo', 'Player'),
      ('RUBEN', 'Rubén', 'Player'),
      ('RUDY', 'Rudy', 'Ramirez'),
      ('VALENCIA', 'Crisanto', 'Valencia'),
      ('VALVERDE', 'Valverde', 'Player'),
      ('VICTOR N', 'Victor', 'Nizama'),
      ('WALTER ACERO', 'Walter', 'Acero')
  ) as seed(import_label, first_name, last_name)
),
player_lookup as (
  select
    player_aliases.import_label,
    p.id as player_id
  from player_aliases
  join public.players p
    on lower(trim(p.first_name)) = lower(trim(player_aliases.first_name))
   and lower(trim(p.last_name)) = lower(trim(player_aliases.last_name))
),
season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower('2025 Summer')
),
matchday_lookup as (
  select md.id, md.matchday_number
  from public.matchdays md
  join season_row on season_row.id = md.season_id
),
assignment_seed as (
  select *
  from (
    values
      ('EMILIO', 1, 'orange'),
      ('JHONATAN A', 1, 'magenta'),
      ('JUAN PABLO', 1, 'blue'),
      ('KARTER', 1, 'green'),
      ('NICOLÁS GALVIZ', 1, 'green'),
      ('VICTOR N', 1, 'green'),
      ('ALEX', 1, 'magenta'),
      ('ALEXIS', 1, 'magenta'),
      ('CHATO', 1, 'blue'),
      ('CHAVITO', 1, 'blue'),
      ('CHILAS', 1, 'green'),
      ('CUÑIS', 1, 'blue'),
      ('DAVID', 1, 'orange'),
      ('EDER', 1, 'magenta'),
      ('EFRA', 1, 'orange'),
      ('ENERSON', 1, 'orange'),
      ('FABIAN', 1, 'magenta'),
      ('FER', 1, 'magenta'),
      ('GABRIEL', 1, 'green'),
      ('GERARDO', 1, 'blue'),
      ('GUS', 1, 'green'),
      ('JAVIER', 1, 'green'),
      ('JEFF', 1, 'blue'),
      ('JHONY S', 1, 'orange'),
      ('JORDAN', 1, 'magenta'),
      ('JOSE SARZA', 1, 'green'),
      ('KEVIN', 1, 'orange'),
      ('MIKEY', 1, 'magenta'),
      ('OSMIN', 1, 'orange'),
      ('RODOLFO', 1, 'blue'),
      ('RODRIGO', 1, 'orange'),
      ('RUBEN', 1, 'blue'),
      ('VALENCIA', 1, 'blue'),
      ('VALVERDE', 1, 'orange'),
      ('ASDRUVAL', 1, 'magenta'),
      ('ANDRES', 1, 'green'),
      ('NICOLÁS GALVIZ', 2, 'green'),
      ('VALENCIA', 2, 'orange'),
      ('VICTOR N', 2, 'green'),
      ('LOPEZ', 2, 'blue'),
      ('CHATO', 2, 'magenta'),
      ('COTI', 2, 'orange'),
      ('NETTO', 2, 'blue'),
      ('CUÑIS', 2, 'blue'),
      ('DAVID', 2, 'orange'),
      ('EDER', 2, 'green'),
      ('EFRA', 2, 'blue'),
      ('ENERSON', 2, 'orange'),
      ('FABIAN', 2, 'orange'),
      ('GABRIEL', 2, 'magenta'),
      ('GERARDO', 2, 'magenta'),
      ('GUS', 2, 'blue'),
      ('JAVIER', 2, 'magenta'),
      ('JEFF', 2, 'green'),
      ('JHONY S', 2, 'blue'),
      ('JORDAN', 2, 'green'),
      ('JOSE BLANCO', 2, 'orange'),
      ('JOSE SARZA', 2, 'orange'),
      ('MIKE', 2, 'magenta'),
      ('MIKEY', 2, 'green'),
      ('OSMIN', 2, 'magenta'),
      ('PIRLO', 2, 'magenta'),
      ('ROB', 2, 'blue'),
      ('RODOLFO', 2, 'magenta'),
      ('RODRIGO', 2, 'green'),
      ('RUBEN', 2, 'green'),
      ('RUDY', 2, 'blue'),
      ('CHRIS', 2, 'blue'),
      ('VALVERDE', 2, 'orange'),
      ('ASDRUVAL', 2, 'green'),
      ('CARLOS S.', 2, 'magenta'),
      ('ANDRES', 2, 'orange'),
      ('ALEX', 3, 'orange'),
      ('JUAN PABLO', 3, 'green'),
      ('NICOLÁS GALVIZ', 3, 'green'),
      ('VICTOR N', 3, 'orange'),
      ('CHATO', 3, 'magenta'),
      ('CHAVITO', 3, 'blue'),
      ('CHILAS', 3, 'magenta'),
      ('CUÑIS', 3, 'orange'),
      ('DAVID', 3, 'magenta'),
      ('EDER', 3, 'blue'),
      ('ENERSON', 3, 'orange'),
      ('FABIAN', 3, 'blue'),
      ('FER', 3, 'orange'),
      ('GABRIEL', 3, 'blue'),
      ('GERARDO', 3, 'magenta'),
      ('JAVIER', 3, 'blue'),
      ('JEFF', 3, 'orange'),
      ('JORDAN', 3, 'green'),
      ('JOSE BLANCO', 3, 'green'),
      ('JOSE SARZA', 3, 'orange'),
      ('KEVIN', 3, 'magenta'),
      ('MIKEY', 3, 'green'),
      ('NICKY', 3, 'green'),
      ('OSMIN', 3, 'blue'),
      ('PIRLO', 3, 'green'),
      ('ROB', 3, 'green'),
      ('RODOLFO', 3, 'magenta'),
      ('RODRIGO', 3, 'magenta'),
      ('RUBEN', 3, 'blue'),
      ('RUDY', 3, 'blue'),
      ('CHRIS', 3, 'orange'),
      ('VALVERDE', 3, 'blue'),
      ('ASDRUVAL', 3, 'orange'),
      ('CARLOS S.', 3, 'green'),
      ('ANDRES', 3, 'magenta'),
      ('JUAN PABLO', 4, 'green'),
      ('KARTER', 4, 'blue'),
      ('VICTOR N', 4, 'orange'),
      ('WALTER ACERO', 4, 'magenta'),
      ('ALEX', 4, 'green'),
      ('CHATO', 4, 'blue'),
      ('COTI', 4, 'orange'),
      ('NETTO', 4, 'green'),
      ('CUÑIS', 4, 'green'),
      ('DAVID', 4, 'green'),
      ('EDER', 4, 'orange'),
      ('EFRA', 4, 'magenta'),
      ('ENERSON', 4, 'blue'),
      ('FABIAN', 4, 'blue'),
      ('GABRIEL', 4, 'blue'),
      ('GERARDO', 4, 'green'),
      ('GUS', 4, 'orange'),
      ('JAVIER', 4, 'blue'),
      ('JHONY S', 4, 'green'),
      ('JOSE BLANCO', 4, 'green'),
      ('JOSE SARZA', 4, 'magenta'),
      ('MIKE', 4, 'blue'),
      ('MIKEY', 4, 'magenta'),
      ('NICKY', 4, 'magenta'),
      ('OSMIN', 4, 'magenta'),
      ('PIRLO', 4, 'magenta'),
      ('ROB', 4, 'orange'),
      ('RODOLFO', 4, 'orange'),
      ('RODRIGO', 4, 'magenta'),
      ('RUBEN', 4, 'orange'),
      ('RUDY', 4, 'magenta'),
      ('VALENCIA', 4, 'blue'),
      ('VALVERDE', 4, 'green'),
      ('ASDRUVAL', 4, 'blue'),
      ('CARLOS S.', 4, 'orange'),
      ('ANDRES', 4, 'orange'),
      ('VICTOR N', 5, 'magenta'),
      ('ALEXIS', 5, 'magenta'),
      ('CHATO', 5, 'green'),
      ('CHAVITO', 5, 'orange'),
      ('CHILAS', 5, 'magenta'),
      ('CUÑIS', 5, 'orange'),
      ('DAVID', 5, 'green'),
      ('EDER', 5, 'blue'),
      ('EFRA', 5, 'blue'),
      ('ENERSON', 5, 'blue'),
      ('FABIAN', 5, 'orange'),
      ('FER', 5, 'green'),
      ('GABRIEL', 5, 'blue'),
      ('GERARDO', 5, 'green'),
      ('GUS', 5, 'blue'),
      ('JAVIER', 5, 'green'),
      ('JEFF', 5, 'orange'),
      ('JHONY S', 5, 'green'),
      ('JORDAN', 5, 'magenta'),
      ('JOSE BLANCO', 5, 'magenta'),
      ('JOSE SARZA', 5, 'green'),
      ('KEVIN', 5, 'green'),
      ('MIKEY', 5, 'blue'),
      ('NICKY', 5, 'blue'),
      ('OSMIN', 5, 'orange'),
      ('PIRLO', 5, 'blue'),
      ('ROB', 5, 'magenta'),
      ('RODOLFO', 5, 'magenta'),
      ('RODRIGO', 5, 'orange'),
      ('RUBEN', 5, 'magenta'),
      ('RUDY', 5, 'orange'),
      ('CHRIS', 5, 'orange'),
      ('VALVERDE', 5, 'magenta'),
      ('ASDRUVAL', 5, 'orange'),
      ('CARLOS S.', 5, 'blue'),
      ('ANDRES', 5, 'green')
  ) as seed(import_label, matchday_number, team_code)
)
insert into public.matchday_assignments (matchday_id, player_id, team_code)
select
  matchday_lookup.id,
  player_lookup.player_id,
  assignment_seed.team_code
from assignment_seed
join player_lookup
  on player_lookup.import_label = assignment_seed.import_label
join matchday_lookup
  on matchday_lookup.matchday_number = assignment_seed.matchday_number;

with player_aliases as (
  select *
  from (
    values
      ('ALEX', 'Alex', 'Meneses'),
      ('ALEXIS', 'Alexis', 'Player'),
      ('ANDRES', 'Andres', 'Aguayo'),
      ('ASDRUVAL', 'Asdruval', 'Villanueva'),
      ('CARLOS S.', 'Carlos', 'Silva'),
      ('CHATO', 'Jose', 'Cerf'),
      ('CHAVITO', 'Chavito', 'Player'),
      ('CHILAS', 'Chilas', 'Player'),
      ('CHRIS', 'Chris', 'Player'),
      ('COTI', 'Coti', 'Player'),
      ('CUÑIS', 'Luis Enrique', 'Martinez'),
      ('DAVID', 'David', 'Toro'),
      ('EDER', 'Eder', 'Martinez'),
      ('EFRA', 'Efrain', 'Jauregui'),
      ('EMILIO', 'Emilio', 'Player'),
      ('ENERSON', 'Enerson', 'Player'),
      ('FABIAN', 'Fabian', 'Munoz'),
      ('FER', 'Fer', 'Player'),
      ('GABRIEL', 'Gabriel', 'Alava'),
      ('GERARDO', 'Gerardo', 'Mendizabal'),
      ('GUS', 'Gus', 'Player'),
      ('JAVIER', 'Luis', 'Urueta'),
      ('JEFF', 'Jeff', 'Arce'),
      ('JHONATAN A', 'Jhonatan', 'Player'),
      ('JHONY S', 'Jhony', 'Sanchez'),
      ('JORDAN', 'Jordan', 'Toledo'),
      ('JOSE BLANCO', 'José', 'Blanco'),
      ('JOSE SARZA', 'Jose', 'Sarza'),
      ('JUAN PABLO', 'Juan Pablo', 'Valladares'),
      ('KARTER', 'Karter', 'Player'),
      ('KEVIN', 'Kevin', 'Player'),
      ('LOPEZ', 'López', 'Player'),
      ('MIKE', 'Mike', 'Player'),
      ('MIKEY', 'Michael', 'Enriquez'),
      ('NETTO', 'Netto', 'Player'),
      ('NICKY', 'Nicky', 'Diaz'),
      ('NICOLÁS GALVIZ', 'Nicolas', 'Galviz'),
      ('OSMIN', 'Osmin', 'Dleon'),
      ('PIRLO', 'Oscar', 'Rosales'),
      ('ROB', 'Rob', 'Player'),
      ('RODOLFO', 'Rodolfo', 'Toledo'),
      ('RODRIGO', 'Rodrigo', 'Player'),
      ('RUBEN', 'Rubén', 'Player'),
      ('RUDY', 'Rudy', 'Ramirez'),
      ('VALENCIA', 'Crisanto', 'Valencia'),
      ('VALVERDE', 'Valverde', 'Player'),
      ('VICTOR N', 'Victor', 'Nizama'),
      ('WALTER ACERO', 'Walter', 'Acero')
  ) as seed(import_label, first_name, last_name)
),
player_lookup as (
  select
    player_aliases.import_label,
    p.id as player_id
  from player_aliases
  join public.players p
    on lower(trim(p.first_name)) = lower(trim(player_aliases.first_name))
   and lower(trim(p.last_name)) = lower(trim(player_aliases.last_name))
),
season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower('2025 Summer')
),
matchday_lookup as (
  select md.id, md.matchday_number
  from public.matchdays md
  join season_row on season_row.id = md.season_id
),
stat_seed as (
  select *
  from (
    values
      ('ALEX', 1, true, 'attended', 1, 0, false),
      ('ALEXIS', 1, true, 'attended', 0, 0, false),
      ('ANDRES', 1, true, 'attended', 0, 0, false),
      ('ASDRUVAL', 1, true, 'attended', 0, 0, false),
      ('CHATO', 1, true, 'attended', 0, 0, false),
      ('CHAVITO', 1, true, 'attended', 0, 0, false),
      ('CHILAS', 1, true, 'attended', 0, 0, false),
      ('CUÑIS', 1, true, 'attended', 0, 0, false),
      ('DAVID', 1, true, 'attended', 0, 0, false),
      ('EDER', 1, true, 'attended', 0, 0, false),
      ('EFRA', 1, true, 'attended', 0, 0, false),
      ('EMILIO', 1, true, 'attended', 0, 0, false),
      ('ENERSON', 1, true, 'attended', 0, 0, false),
      ('FABIAN', 1, true, 'attended', 0, 0, false),
      ('FER', 1, true, 'attended', 0, 1, false),
      ('GABRIEL', 1, true, 'attended', 1, 0, false),
      ('GERARDO', 1, true, 'attended', 0, 0, false),
      ('GUS', 1, true, 'attended', 1, 0, false),
      ('JAVIER', 1, true, 'attended', 1, 0, false),
      ('JEFF', 1, true, 'attended', 1, 0, false),
      ('JHONATAN A', 1, true, 'attended', 0, 0, false),
      ('JHONY S', 1, true, 'attended', 0, 0, false),
      ('JORDAN', 1, true, 'attended', 0, 0, false),
      ('JOSE SARZA', 1, true, 'attended', 0, 0, false),
      ('JUAN PABLO', 1, true, 'attended', 2, 0, false),
      ('KARTER', 1, true, 'attended', 0, 0, false),
      ('KEVIN', 1, true, 'attended', 0, 0, false),
      ('MIKEY', 1, true, 'attended', 0, 0, false),
      ('NICOLÁS GALVIZ', 1, true, 'attended', 0, 0, false),
      ('OSMIN', 1, true, 'attended', 0, 0, false),
      ('RODOLFO', 1, true, 'attended', 0, 1, true),
      ('RODRIGO', 1, true, 'attended', 0, 0, false),
      ('RUBEN', 1, true, 'attended', 1, 0, false),
      ('VALENCIA', 1, true, 'attended', 2, 0, false),
      ('VALVERDE', 1, true, 'attended', 1, 0, false),
      ('VICTOR N', 1, true, 'attended', 0, 0, false),
      ('ANDRES', 2, true, 'attended', 1, 0, false),
      ('ASDRUVAL', 2, true, 'attended', 0, 0, false),
      ('CARLOS S.', 2, true, 'attended', 0, 0, false),
      ('CHATO', 2, true, 'attended', 1, 0, false),
      ('CHRIS', 2, true, 'attended', 0, 0, false),
      ('COTI', 2, true, 'attended', 0, 0, false),
      ('CUÑIS', 2, true, 'attended', 0, 0, false),
      ('DAVID', 2, true, 'attended', 0, 0, false),
      ('EDER', 2, true, 'attended', 1, 0, false),
      ('EFRA', 2, true, 'attended', 0, 0, false),
      ('ENERSON', 2, true, 'attended', 0, 1, true),
      ('FABIAN', 2, true, 'attended', 0, 0, false),
      ('GABRIEL', 2, true, 'attended', 0, 0, false),
      ('GERARDO', 2, true, 'attended', 0, 0, false),
      ('GUS', 2, true, 'attended', 1, 1, false),
      ('JAVIER', 2, true, 'attended', 0, 0, false),
      ('JEFF', 2, true, 'attended', 0, 0, false),
      ('JHONY S', 2, true, 'attended', 0, 0, false),
      ('JORDAN', 2, true, 'attended', 0, 0, false),
      ('JOSE BLANCO', 2, true, 'attended', 0, 0, false),
      ('JOSE SARZA', 2, true, 'attended', 0, 0, false),
      ('LOPEZ', 2, true, 'attended', 0, 0, false),
      ('MIKE', 2, true, 'attended', 0, 1, true),
      ('MIKEY', 2, true, 'attended', 0, 0, false),
      ('NETTO', 2, true, 'attended', 1, 0, false),
      ('NICOLAS GALVIZ', 2, true, 'attended', 0, 1, false),
      ('NICOLÁS GALVIZ', 2, true, 'attended', 0, 0, false),
      ('OSMIN', 2, true, 'attended', 0, 0, false),
      ('PIRLO', 2, true, 'attended', 0, 0, false),
      ('ROB', 2, true, 'attended', 0, 1, false),
      ('RODOLFO', 2, true, 'attended', 0, 0, false),
      ('RODRIGO', 2, true, 'attended', 0, 0, false),
      ('RUBEN', 2, true, 'attended', 1, 0, false),
      ('RUDY', 2, true, 'attended', 0, 0, false),
      ('VALENCIA', 2, true, 'attended', 0, 0, false),
      ('VALVERDE', 2, true, 'attended', 0, 0, false),
      ('VICTOR N', 2, true, 'attended', 0, 0, false),
      ('ALEX', 3, true, 'attended', 0, 0, false),
      ('ANDRES', 3, true, 'attended', 0, 0, false),
      ('ASDRUVAL', 3, true, 'attended', 0, 0, false),
      ('CARLOS S.', 3, true, 'attended', 1, 0, false),
      ('CHATO', 3, true, 'attended', 1, 0, false),
      ('CHAVITO', 3, true, 'attended', 0, 0, false),
      ('CHILAS', 3, true, 'attended', 0, 0, false),
      ('CHRIS', 3, true, 'attended', 0, 0, false),
      ('CUÑIS', 3, true, 'attended', 0, 0, false),
      ('DAVID', 3, true, 'attended', 0, 0, false),
      ('EDER', 3, true, 'attended', 1, 0, false),
      ('ENERSON', 3, true, 'attended', 0, 0, false),
      ('FABIAN', 3, true, 'attended', 0, 1, true),
      ('FER', 3, true, 'attended', 0, 1, false),
      ('GABRIEL', 3, true, 'attended', 0, 0, false),
      ('GERARDO', 3, true, 'attended', 1, 0, false),
      ('JAVIER', 3, true, 'attended', 0, 0, false),
      ('JEFF', 3, true, 'attended', 0, 0, false),
      ('JORDAN', 3, true, 'attended', 0, 1, true),
      ('JOSE BLANCO', 3, true, 'attended', 1, 0, false),
      ('JOSE SARZA', 3, true, 'attended', 1, 0, false),
      ('JUAN PABLO', 3, true, 'attended', 0, 0, false),
      ('KEVIN', 3, true, 'attended', 0, 0, false),
      ('MIKEY', 3, true, 'attended', 0, 0, false),
      ('NICKY', 3, true, 'attended', 0, 0, false),
      ('NICOLÁS GALVIZ', 3, true, 'attended', 0, 0, false),
      ('OSMIN', 3, true, 'attended', 0, 0, false),
      ('PIRLO', 3, true, 'attended', 0, 0, false),
      ('ROB', 3, true, 'attended', 0, 1, false),
      ('RODOLFO', 3, true, 'attended', 0, 1, false),
      ('RODRIGO', 3, true, 'attended', 0, 0, false),
      ('RUBEN', 3, true, 'attended', 0, 0, false),
      ('RUDY', 3, true, 'attended', 1, 0, false),
      ('VALVERDE', 3, true, 'attended', 1, 0, false),
      ('VICTOR N', 3, true, 'attended', 0, 0, false),
      ('ALEX', 4, true, 'attended', 0, 0, false),
      ('ANDRES', 4, true, 'attended', 0, 0, false),
      ('ASDRUVAL', 4, true, 'attended', 0, 0, false),
      ('CARLOS S.', 4, true, 'attended', 0, 0, false),
      ('CHATO', 4, true, 'attended', 0, 0, false),
      ('COTI', 4, true, 'attended', 0, 0, false),
      ('CUÑIS', 4, true, 'attended', 0, 1, false),
      ('DAVID', 4, true, 'attended', 0, 0, false),
      ('EDER', 4, true, 'attended', 0, 0, false),
      ('EFRA', 4, true, 'attended', 0, 0, false),
      ('ENERSON', 4, true, 'attended', 0, 0, false),
      ('FABIAN', 4, true, 'attended', 0, 0, false),
      ('GABRIEL', 4, true, 'attended', 0, 0, false),
      ('GERARDO', 4, true, 'attended', 0, 0, false),
      ('GUS', 4, true, 'attended', 1, 0, false),
      ('JAVIER', 4, true, 'attended', 0, 0, false),
      ('JHONY S', 4, true, 'attended', 1, 0, false),
      ('JOSE BLANCO', 4, true, 'attended', 0, 0, false),
      ('JOSE SARZA', 4, true, 'attended', 1, 0, false),
      ('JUAN PABLO', 4, true, 'attended', 4, 0, false),
      ('KARTER', 4, true, 'attended', 0, 0, false),
      ('MIKE', 4, true, 'attended', 0, 1, false),
      ('MIKEY', 4, true, 'attended', 1, 0, false),
      ('NETTO', 4, true, 'attended', 0, 0, false),
      ('NICKY', 4, true, 'attended', 0, 0, false),
      ('OSMIN', 4, true, 'attended', 2, 0, false),
      ('PIRLO', 4, true, 'attended', 0, 0, false),
      ('ROB', 4, true, 'attended', 0, 0, false),
      ('RODOLFO', 4, true, 'attended', 0, 0, false),
      ('RODRIGO', 4, true, 'attended', 1, 0, false),
      ('RUBEN', 4, true, 'attended', 1, 0, false),
      ('RUDY', 4, true, 'attended', 0, 0, false),
      ('VALENCIA', 4, true, 'attended', 3, 0, false),
      ('VALVERDE', 4, true, 'attended', 0, 0, false),
      ('VICTOR N', 4, true, 'attended', 0, 0, false),
      ('WALTER ACERO', 4, true, 'attended', 0, 0, false),
      ('ALEXIS', 5, true, 'attended', 0, 0, false),
      ('ANDRES', 5, true, 'attended', 0, 0, false),
      ('ASDRUVAL', 5, true, 'attended', 0, 0, false),
      ('CARLOS S.', 5, true, 'attended', 0, 0, false),
      ('CHATO', 5, true, 'attended', 0, 0, false),
      ('CHAVITO', 5, true, 'attended', 0, 0, false),
      ('CHILAS', 5, true, 'attended', 0, 0, false),
      ('CHRIS', 5, true, 'attended', 0, 0, false),
      ('CUÑIS', 5, true, 'attended', 0, 0, false),
      ('DAVID', 5, true, 'attended', 0, 0, false),
      ('EDER', 5, true, 'attended', 0, 0, false),
      ('EFRA', 5, true, 'attended', 0, 0, false),
      ('ENERSON', 5, true, 'attended', 0, 0, false),
      ('FABIAN', 5, true, 'attended', 0, 0, false),
      ('FER', 5, true, 'attended', 0, 0, false),
      ('GABRIEL', 5, true, 'attended', 0, 0, false),
      ('GERARDO', 5, true, 'attended', 0, 0, false),
      ('GUS', 5, true, 'attended', 0, 0, false),
      ('JAVIER', 5, true, 'attended', 0, 0, false),
      ('JEFF', 5, true, 'attended', 0, 0, false),
      ('JHONY S', 5, true, 'attended', 0, 0, false),
      ('JORDAN', 5, true, 'attended', 0, 0, false),
      ('JOSE BLANCO', 5, true, 'attended', 0, 0, false),
      ('JOSE SARZA', 5, true, 'attended', 0, 0, false),
      ('KEVIN', 5, true, 'attended', 0, 0, false),
      ('MIKEY', 5, true, 'attended', 0, 0, false),
      ('NICKY', 5, true, 'attended', 0, 0, false),
      ('OSMIN', 5, true, 'attended', 0, 0, false),
      ('PIRLO', 5, true, 'attended', 0, 0, false),
      ('ROB', 5, true, 'attended', 0, 0, false),
      ('RODOLFO', 5, true, 'attended', 0, 0, false),
      ('RODRIGO', 5, true, 'attended', 0, 0, false),
      ('RUBEN', 5, true, 'attended', 0, 0, false),
      ('RUDY', 5, true, 'attended', 0, 0, false),
      ('VALVERDE', 5, true, 'attended', 0, 0, false),
      ('VICTOR N', 5, true, 'attended', 0, 0, false)
  ) as seed(import_label, matchday_number, attended, attendance_status, goals, goal_keeps, clean_sheet)
)
insert into public.matchday_player_stats (
  matchday_id,
  player_id,
  attended,
  attendance_status,
  goals,
  goal_keeps,
  clean_sheet
)
select
  matchday_lookup.id,
  player_lookup.player_id,
  stat_seed.attended,
  stat_seed.attendance_status,
  stat_seed.goals,
  stat_seed.goal_keeps,
  stat_seed.clean_sheet
from stat_seed
join player_lookup
  on player_lookup.import_label = stat_seed.import_label
join matchday_lookup
  on matchday_lookup.matchday_number = stat_seed.matchday_number;

with player_aliases as (
  select *
  from (
    values
      ('ALEX', 'Alex', 'Meneses'),
      ('ALEXIS', 'Alexis', 'Player'),
      ('ANDRES', 'Andres', 'Aguayo'),
      ('ASDRUVAL', 'Asdruval', 'Villanueva'),
      ('CARLOS S.', 'Carlos', 'Silva'),
      ('CHATO', 'Jose', 'Cerf'),
      ('CHAVITO', 'Chavito', 'Player'),
      ('CHILAS', 'Chilas', 'Player'),
      ('CHRIS', 'Chris', 'Player'),
      ('COTI', 'Coti', 'Player'),
      ('CUÑIS', 'Luis Enrique', 'Martinez'),
      ('DAVID', 'David', 'Toro'),
      ('EDER', 'Eder', 'Martinez'),
      ('EFRA', 'Efrain', 'Jauregui'),
      ('EMILIO', 'Emilio', 'Player'),
      ('ENERSON', 'Enerson', 'Player'),
      ('FABIAN', 'Fabian', 'Munoz'),
      ('FER', 'Fer', 'Player'),
      ('GABRIEL', 'Gabriel', 'Alava'),
      ('GERARDO', 'Gerardo', 'Mendizabal'),
      ('GUS', 'Gus', 'Player'),
      ('JAVIER', 'Luis', 'Urueta'),
      ('JEFF', 'Jeff', 'Arce'),
      ('JHONATAN A', 'Jhonatan', 'Player'),
      ('JHONY S', 'Jhony', 'Sanchez'),
      ('JORDAN', 'Jordan', 'Toledo'),
      ('JOSE BLANCO', 'José', 'Blanco'),
      ('JOSE SARZA', 'Jose', 'Sarza'),
      ('JUAN PABLO', 'Juan Pablo', 'Valladares'),
      ('KARTER', 'Karter', 'Player'),
      ('KEVIN', 'Kevin', 'Player'),
      ('LOPEZ', 'López', 'Player'),
      ('MIKE', 'Mike', 'Player'),
      ('MIKEY', 'Michael', 'Enriquez'),
      ('NETTO', 'Netto', 'Player'),
      ('NICKY', 'Nicky', 'Diaz'),
      ('NICOLÁS GALVIZ', 'Nicolas', 'Galviz'),
      ('OSMIN', 'Osmin', 'Dleon'),
      ('PIRLO', 'Oscar', 'Rosales'),
      ('ROB', 'Rob', 'Player'),
      ('RODOLFO', 'Rodolfo', 'Toledo'),
      ('RODRIGO', 'Rodrigo', 'Player'),
      ('RUBEN', 'Rubén', 'Player'),
      ('RUDY', 'Rudy', 'Ramirez'),
      ('VALENCIA', 'Crisanto', 'Valencia'),
      ('VALVERDE', 'Valverde', 'Player'),
      ('VICTOR N', 'Victor', 'Nizama'),
      ('WALTER ACERO', 'Walter', 'Acero')
  ) as seed(import_label, first_name, last_name)
),
player_lookup as (
  select
    player_aliases.import_label,
    p.id as player_id
  from player_aliases
  join public.players p
    on lower(trim(p.first_name)) = lower(trim(player_aliases.first_name))
   and lower(trim(p.last_name)) = lower(trim(player_aliases.last_name))
),
season_row as (
  select id
  from public.seasons
  where lower(trim(name)) = lower('2025 Summer')
),
season_player_seed as (
  select *
  from (
    values
      ('ALEX', 'rotation'),
      ('ALEXIS', 'rotation'),
      ('ANDRES', 'rotation'),
      ('ASDRUVAL', 'rotation'),
      ('CARLOS S.', 'rotation'),
      ('CHATO', 'rotation'),
      ('CHAVITO', 'rotation'),
      ('CHILAS', 'rotation'),
      ('CHRIS', 'rotation'),
      ('COTI', 'rotation'),
      ('CUÑIS', 'rotation'),
      ('DAVID', 'rotation'),
      ('EDER', 'rotation'),
      ('EFRA', 'rotation'),
      ('EMILIO', 'flex_sub'),
      ('ENERSON', 'rotation'),
      ('FABIAN', 'rotation'),
      ('FER', 'rotation'),
      ('GABRIEL', 'rotation'),
      ('GERARDO', 'rotation'),
      ('GUS', 'rotation'),
      ('JAVIER', 'rotation'),
      ('JEFF', 'rotation'),
      ('JHONATAN A', 'flex_sub'),
      ('JHONY S', 'rotation'),
      ('JORDAN', 'rotation'),
      ('JOSE BLANCO', 'rotation'),
      ('JOSE SARZA', 'rotation'),
      ('JUAN PABLO', 'flex_sub'),
      ('KARTER', 'flex_sub'),
      ('KEVIN', 'rotation'),
      ('LOPEZ', 'rotation'),
      ('MIKE', 'rotation'),
      ('MIKEY', 'rotation'),
      ('NETTO', 'rotation'),
      ('NICKY', 'rotation'),
      ('NICOLÁS GALVIZ', 'flex_sub'),
      ('OSMIN', 'rotation'),
      ('PIRLO', 'rotation'),
      ('ROB', 'rotation'),
      ('RODOLFO', 'rotation'),
      ('RODRIGO', 'rotation'),
      ('RUBEN', 'rotation'),
      ('RUDY', 'rotation'),
      ('VALENCIA', 'rotation'),
      ('VALVERDE', 'rotation'),
      ('VICTOR N', 'rotation'),
      ('WALTER ACERO', 'flex_sub')
  ) as seed(import_label, tier_status)
)
insert into public.season_players (
  season_id,
  player_id,
  tier_status,
  tier_reason,
  movement_note,
  is_eligible
)
select distinct
  season_row.id,
  player_lookup.player_id,
  season_player_seed.tier_status,
  'Historical import from a pre-tier workbook.',
  'Imported for archive only. Review manually before using this player in a live season.',
  true
from season_row
join season_player_seed
  on true
join player_lookup
  on player_lookup.import_label = season_player_seed.import_label;

commit;
