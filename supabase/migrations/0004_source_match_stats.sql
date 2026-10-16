-- Paso 12.3.2 — Estadísticas de Oracle's Elixir importadas por partida.
-- Solo el servidor accede con service role; RLS se activa sin políticas públicas.

create table if not exists public.source_match_stats (
  source      text                     not null references public.data_sources(id) on delete cascade,
  game_id     text                     not null,
  payload     jsonb                    not null,
  updated_at  timestamp with time zone not null default now(),
  primary key (source, game_id)
);

alter table public.source_match_stats enable row level security;