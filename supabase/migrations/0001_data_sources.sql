-- Paso 12.1 — Base de datos Supabase: catálogo de fuentes y contador de cuota.
-- Acceso solo desde el servidor con la service role key. RLS activado y SIN políticas:
-- anon/authenticated no pueden leer ni escribir nada.
-- Convención para todas las tablas de datos (12.3): columnas `source` y `updated_at`.

create table if not exists public.data_sources (
  id                   text primary key,
  name                 text        not null,
  access               text        not null check (access in ('api-key','api-open','files')),
  role                 text        not null check (role in ('principal','complementaria','futura')),
  quota_calls          integer     check (quota_calls > 0),
  quota_per            text        check (quota_per in ('hour','month')),
  license              text        not null,
  attribution_required boolean     not null default true,
  recommended          boolean     not null default true,
  researched_on        date        not null,
  updated_at           timestamp with time zone not null default now(),
  check ((quota_calls is null) = (quota_per is null))
);

-- Contador de consumo por fuente y periodo (CitoAPI: 500/mes). Idempotente por (source, period_start).
create table if not exists public.source_quota_usage (
  source       text        not null references public.data_sources(id) on delete cascade,
  period_start date        not null,
  calls        integer     not null default 0 check (calls >= 0),
  updated_at   timestamp with time zone not null default now(),
  primary key (source, period_start)
);

alter table public.data_sources       enable row level security;
alter table public.source_quota_usage enable row level security;

-- Mantiene updated_at al día.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists data_sources_touch on public.data_sources;
create trigger data_sources_touch before update on public.data_sources
  for each row execute function public.touch_updated_at();
drop trigger if exists source_quota_usage_touch on public.source_quota_usage;
create trigger source_quota_usage_touch before update on public.source_quota_usage
  for each row execute function public.touch_updated_at();

-- Incremento atómico del contador (lo usará 12.3 antes de llamar a CitoAPI).
create or replace function public.bump_source_quota(p_source text, p_period date, p_by integer default 1)
returns integer language sql as $$
  insert into public.source_quota_usage (source, period_start, calls)
  values (p_source, p_period, greatest(p_by, 0))
  on conflict (source, period_start)
  do update set calls = public.source_quota_usage.calls + greatest(p_by, 0)
  returning calls;
$$;
revoke all on function public.bump_source_quota(text, date, integer) from public, anon, authenticated;

-- Datos de partida (coinciden con src/lib/sources/catalog.ts; lo verifica tests/step12.test.ts).
insert into public.data_sources (id, name, access, role, quota_calls, quota_per, license, attribution_required, recommended, researched_on) values
  ('pandascore',    'PandaScore Free',                    'api-key',  'principal',      1000, 'hour',  'Términos de uso de PandaScore.', true, true, '2026-10-15'),
  ('citoapi',       'CitoAPI Free',                       'api-key',  'complementaria',  500, 'month', 'Términos de uso de CitoAPI (revisar antes de publicar).', true, true, '2026-10-15'),
  ('oracleselixir', 'Oracle''s Elixir',                   'files',    'complementaria', null, null,   'Datos de Riot Games distribuidos por Oracle''s Elixir; revisar sus condiciones de reutilización.', true, true, '2026-10-15'),
  ('leaguepedia',   'Leaguepedia (Cargo API)',            'api-open', 'complementaria', null, null,   'CC-BY-SA.', true, true, '2026-10-15'),
  ('datadragon',    'Data Dragon (Riot)',                 'api-open', 'complementaria', null, null,   'Contenido de Riot Games; seguir sus políticas de uso.', true, true, '2026-10-15'),
  ('riotapi',       'API de Riot (clave de desarrollador)','api-key', 'futura',         null, null,   'Términos de la API de Riot Games.', true, true, '2026-10-15')
on conflict (id) do update set
  name = excluded.name, access = excluded.access, role = excluded.role,
  quota_calls = excluded.quota_calls, quota_per = excluded.quota_per, license = excluded.license,
  attribution_required = excluded.attribution_required, recommended = excluded.recommended,
  researched_on = excluded.researched_on;
