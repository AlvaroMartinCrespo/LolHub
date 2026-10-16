-- Paso 12.3.1 — Tabla de equivalencias de identificadores entre fuentes.
-- Refleja src/lib/sources/equivalences.ts. El ID canónico es siempre el de PandaScore.
-- Regla del plan: no fusionar por nombre sin revisar → solo las filas 'confirmed' resuelven, y confirmar exige revisor y fecha.
-- Acceso solo desde el servidor (service role). RLS activado y SIN políticas.

create table if not exists public.entity_equivalences (
  id                bigint generated always as identity primary key,
  kind              text not null check (kind in ('team','player','tournament','league')),
  canonical_source  text not null default 'pandascore' check (canonical_source = 'pandascore'),
  canonical_id      text not null,
  external_source   text not null references public.data_sources(id) on delete restrict check (external_source <> 'pandascore'),
  external_id       text not null,
  status            text not null check (status in ('confirmed','proposed','rejected')),
  method            text not null check (method in ('manual','suggested')),
  evidence          text not null default '',
  reviewed_by       text,
  reviewed_at       timestamp with time zone,
  updated_at        timestamp with time zone not null default now(),
  -- Un par (canónico, externo) solo puede aparecer una vez.
  unique (kind, canonical_id, external_source, external_id),
  -- Confirmar o rechazar exige revisión humana con evidencia.
  check (status = 'proposed' or (reviewed_by is not null and length(btrim(reviewed_by)) > 0 and reviewed_at is not null and length(btrim(evidence)) > 0)),
  check (not (status = 'proposed' and method = 'manual'))
);

-- Un externo solo puede estar confirmado con un canónico.
create unique index if not exists entity_equivalences_one_confirmed_per_external
  on public.entity_equivalences (kind, external_source, external_id) where status = 'confirmed';
-- Un canónico solo puede tener un externo confirmado por fuente.
create unique index if not exists entity_equivalences_one_confirmed_per_canonical_source
  on public.entity_equivalences (kind, canonical_id, external_source) where status = 'confirmed';

alter table public.entity_equivalences enable row level security;

drop trigger if exists entity_equivalences_touch on public.entity_equivalences;
create trigger entity_equivalences_touch before update on public.entity_equivalences
  for each row execute function public.touch_updated_at();
