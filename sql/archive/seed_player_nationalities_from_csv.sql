begin;

-- FIX: restore player nationalities from the CSV seed without touching rows whose CSV nationality
-- is missing (#N/A). Matching prefers nickname, then full name, then a small first-name fallback
-- for workbook rows whose display name differs from the app registry name.
with seed(player_name, nationality) as (
  values
    ('Andrés', 'Ecuador'),
    ('Rob', 'El Salvador'),
    ('Fabián', 'Mexico'),
    ('Efraín', 'Mexico'),
    ('Mikey', 'Mexico'),
    ('Gerardo', 'Mexico'),
    ('David', 'Ecuador'),
    ('Coti', 'Peru'),
    ('Cuñis', 'Mexico'),
    ('Carlos S', 'Peru'),
    ('Eder', 'Mexico'),
    ('Asdruval', 'Mexico'),
    ('Alex', 'Peru'),
    ('Fer', 'Mexico'),
    ('Chavito', 'Mexico'),
    ('Guille', 'Bolivia'),
    ('Gus', 'El Salvador'),
    ('Gustavo Ortiz', 'Mexico'),
    ('Javier', 'Mexico'),
    ('Jeff Arce', 'Costa Rica'),
    ('Jhony', 'Mexico'),
    ('Jordan', 'Mexico'),
    ('José Blanco', 'Mexico'),
    ('José Sarza', 'Mexico'),
    ('Karter', 'USA'),
    ('Kevin', 'El Salvador'),
    ('López', 'Mexico'),
    ('Luis', 'Mexico'),
    ('Mike', 'El Salvador'),
    ('Chato', 'Chile'),
    ('Nicky', 'Peru'),
    ('Nizama', 'Peru'),
    ('Pablo', 'Chile'),
    ('Pirlo', 'El Salvador'),
    ('Alexis', 'Mexico'),
    ('Rodolfo', 'Mexico'),
    ('Rodrigo', 'Nicaragua'),
    ('Rubén', 'Peru'),
    ('Saul', 'Ecuador'),
    ('Sergio', 'Chile'),
    ('Uriel Ortiz', 'Mexico'),
    ('Valencia', 'Mexico'),
    ('Valverde', 'Mexico'),
    ('Gabo', 'Ecuador')
),
normalized_seed as (
  select
    trim(player_name) as player_name,
    trim(nationality) as nationality,
    lower(trim(player_name)) as norm_name,
    lower(trim(split_part(player_name, ' ', 1))) as norm_first_name
  from seed
),
candidate_matches as (
  select
    s.player_name,
    s.nationality,
    p.id as player_id,
    p.first_name,
    p.last_name,
    p.nickname,
    case
      when lower(trim(coalesce(p.nickname, ''))) = s.norm_name then 1
      when lower(trim(p.first_name || ' ' || p.last_name)) = s.norm_name then 2
      when s.player_name in ('Gustavo Ortiz', 'Uriel Ortiz', 'Luis')
        and lower(trim(p.first_name)) = s.norm_first_name then 3
      when lower(trim(p.first_name)) = s.norm_name then 4
      else 99
    end as match_priority
  from normalized_seed s
  join public.players p
    on (
      lower(trim(coalesce(p.nickname, ''))) = s.norm_name
      or lower(trim(p.first_name || ' ' || p.last_name)) = s.norm_name
      or lower(trim(p.first_name)) = s.norm_name
      or (
        s.player_name in ('Gustavo Ortiz', 'Uriel Ortiz', 'Luis')
        and lower(trim(p.first_name)) = s.norm_first_name
      )
    )
),
ranked_matches as (
  select
    *,
    row_number() over (
      partition by player_name
      order by match_priority, player_id
    ) as choice_rank,
    count(*) over (
      partition by player_name, match_priority
    ) as matches_at_priority
  from candidate_matches
  where match_priority < 99
),
resolved as (
  select *
  from ranked_matches
  where choice_rank = 1
    and matches_at_priority = 1
),
updated as (
  update public.players p
  set
    nationality = r.nationality,
    updated_at = now()
  from resolved r
  where p.id = r.player_id
  returning
    p.id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.nationality
)
select *
from updated
order by first_name, last_name;

with seed(player_name, nationality) as (
  values
    ('Andrés', 'Ecuador'),
    ('Rob', 'El Salvador'),
    ('Fabián', 'Mexico'),
    ('Efraín', 'Mexico'),
    ('Mikey', 'Mexico'),
    ('Gerardo', 'Mexico'),
    ('David', 'Ecuador'),
    ('Coti', 'Peru'),
    ('Cuñis', 'Mexico'),
    ('Carlos S', 'Peru'),
    ('Eder', 'Mexico'),
    ('Asdruval', 'Mexico'),
    ('Alex', 'Peru'),
    ('Fer', 'Mexico'),
    ('Chavito', 'Mexico'),
    ('Guille', 'Bolivia'),
    ('Gus', 'El Salvador'),
    ('Gustavo Ortiz', 'Mexico'),
    ('Javier', 'Mexico'),
    ('Jeff Arce', 'Costa Rica'),
    ('Jhony', 'Mexico'),
    ('Jordan', 'Mexico'),
    ('José Blanco', 'Mexico'),
    ('José Sarza', 'Mexico'),
    ('Karter', 'USA'),
    ('Kevin', 'El Salvador'),
    ('López', 'Mexico'),
    ('Luis', 'Mexico'),
    ('Mike', 'El Salvador'),
    ('Chato', 'Chile'),
    ('Nicky', 'Peru'),
    ('Nizama', 'Peru'),
    ('Pablo', 'Chile'),
    ('Pirlo', 'El Salvador'),
    ('Alexis', 'Mexico'),
    ('Rodolfo', 'Mexico'),
    ('Rodrigo', 'Nicaragua'),
    ('Rubén', 'Peru'),
    ('Saul', 'Ecuador'),
    ('Sergio', 'Chile'),
    ('Uriel Ortiz', 'Mexico'),
    ('Valencia', 'Mexico'),
    ('Valverde', 'Mexico'),
    ('Gabo', 'Ecuador')
),
normalized_seed as (
  select
    trim(player_name) as player_name,
    trim(nationality) as nationality,
    lower(trim(player_name)) as norm_name,
    lower(trim(split_part(player_name, ' ', 1))) as norm_first_name
  from seed
),
candidate_matches as (
  select
    s.player_name,
    case
      when lower(trim(coalesce(p.nickname, ''))) = s.norm_name then 1
      when lower(trim(p.first_name || ' ' || p.last_name)) = s.norm_name then 2
      when s.player_name in ('Gustavo Ortiz', 'Uriel Ortiz', 'Luis')
        and lower(trim(p.first_name)) = s.norm_first_name then 3
      when lower(trim(p.first_name)) = s.norm_name then 4
      else 99
    end as match_priority,
    p.id as player_id
  from normalized_seed s
  join public.players p
    on (
      lower(trim(coalesce(p.nickname, ''))) = s.norm_name
      or lower(trim(p.first_name || ' ' || p.last_name)) = s.norm_name
      or lower(trim(p.first_name)) = s.norm_name
      or (
        s.player_name in ('Gustavo Ortiz', 'Uriel Ortiz', 'Luis')
        and lower(trim(p.first_name)) = s.norm_first_name
      )
    )
),
ranked_matches as (
  select
    *,
    row_number() over (
      partition by player_name
      order by match_priority, player_id
    ) as choice_rank,
    count(*) over (
      partition by player_name, match_priority
    ) as matches_at_priority
  from candidate_matches
  where match_priority < 99
),
resolved as (
  select player_name
  from ranked_matches
  where choice_rank = 1
    and matches_at_priority = 1
)
select s.player_name as unmatched_seed_name
from normalized_seed s
left join resolved r
  on r.player_name = s.player_name
where r.player_name is null
order by s.player_name;

commit;
