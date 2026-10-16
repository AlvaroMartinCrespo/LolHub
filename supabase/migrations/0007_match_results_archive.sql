-- Archivo persistente de resultados PandaScore, consultable aunque la liga deje de estar activa.
create table if not exists public.match_result_archive_leagues (
  league_id       bigint primary key,
  league_name     text not null,
  last_result_at  timestamp with time zone,
  updated_at      timestamp with time zone not null default now()
);

create table if not exists public.match_result_archive (
  match_id    bigint primary key,
  league_id   bigint not null,
  played_at   timestamp with time zone,
  payload     jsonb not null,
  updated_at  timestamp with time zone not null default now()
);

create index if not exists match_result_archive_league_date_idx
  on public.match_result_archive (league_id, played_at desc, match_id desc);

alter table public.match_result_archive_leagues enable row level security;
alter table public.match_result_archive enable row level security;