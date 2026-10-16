-- Paso 12.3.2 — Última respuesta válida para fallback entre instancias serverless.
-- Acceso exclusivo del servidor mediante service role; RLS sin políticas.

create table if not exists public.source_snapshots (
  source      text                     not null references public.data_sources(id) on delete cascade,
  cache_key   text                     not null,
  payload     jsonb                    not null,
  updated_at  timestamp with time zone not null default now(),
  primary key (source, cache_key)
);

alter table public.source_snapshots enable row level security;

drop trigger if exists source_snapshots_touch on public.source_snapshots;
create trigger source_snapshots_touch before update on public.source_snapshots
  for each row execute function public.touch_updated_at();