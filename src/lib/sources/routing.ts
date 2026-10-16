/**
 * Paso 12.2 — Reparto de responsabilidades: qué fuente responde a cada tipo de dato,
 * cómo se obtiene y qué reglas de uso tiene. Módulo puro; la capa de unificación (12.3)
 * y los adaptadores consultarán esta tabla en lugar de decidir por su cuenta.
 */
import { getSource, type SourceId } from "./catalog";

export const DATA_KINDS = [
  "schedule", "results", "teams", "players", "tournaments", // PandaScore
  "matchStats", // Oracle's Elixir
  "rosters", "teamHistory", "teamLogos", // Leaguepedia
  "championAssets", // Data Dragon
  "gapFill", // CitoAPI
  "soloQueue", // Riot API
] as const;
export type DataKind = (typeof DATA_KINDS)[number];

/** Cómo llega el dato a la web. */
export type DeliveryMode =
  | "live-api" // consulta al proveedor desde el servidor, con caché de Next
  | "imported" // script programado e idempotente → Supabase; la interfaz solo lee de la base
  | "cached-api" // API consultada con caché larga; nunca por visita
  | "static-cdn" // recursos estáticos versionados
  | "on-demand-gap" // solo para huecos puntuales y si la cuota lo permite
  | "future"; // sin implementar

export interface Route {
  /** Texto de la tabla de responsabilidades (plan 12.2). */
  label: string;
  kinds: readonly DataKind[];
  source: SourceId;
  mode: DeliveryMode;
  note?: string;
  /** ¿Puede llamarse al proveedor en cada visita de usuario? */
  perVisitCalls: boolean;
  /** Caché mínima (s) cuando se consulta al proveedor. 0 = la que defina el tipo de dato (Paso 9). */
  minCacheSeconds: number;
  /** Qué hacer si la fuente falla. */
  onFailure: "last-valid-with-notice" | "omit-and-flag-missing";
  /** ¿Activa hoy? Las integraciones futuras no se consultan. */
  enabled: boolean;
}

const DAY = 86_400;

export const ROUTES: readonly Route[] = [
  {
    label: "Calendario, resultados, equipos, jugadores y torneos",
    kinds: ["schedule", "results", "teams", "players", "tournaments"],
    source: "pandascore", mode: "live-api", perVisitCalls: true, minCacheSeconds: 0,
    onFailure: "last-valid-with-notice", enabled: true,
  },
  {
    label: "Estadísticas históricas por partida",
    kinds: ["matchStats"],
    source: "oracleselixir", mode: "imported", note: "Importado a la base de datos.",
    perVisitCalls: false, minCacheSeconds: 0, onFailure: "omit-and-flag-missing", enabled: true,
  },
  {
    label: "Rosters, historial de equipos y logos",
    kinds: ["rosters", "teamHistory", "teamLogos"],
    source: "leaguepedia", mode: "cached-api", note: "Con caché larga.",
    perVisitCalls: false, minCacheSeconds: DAY, onFailure: "last-valid-with-notice", enabled: true,
  },
  {
    label: "Imágenes y datos de campeones",
    kinds: ["championAssets"],
    source: "datadragon", mode: "static-cdn", perVisitCalls: true, minCacheSeconds: DAY,
    onFailure: "omit-and-flag-missing", enabled: true,
  },
  {
    label: "Huecos puntuales",
    kinds: ["gapFill"],
    source: "citoapi", mode: "on-demand-gap", note: "Solo si la cuota lo permite.",
    perVisitCalls: false, minCacheSeconds: 7 * DAY, onFailure: "omit-and-flag-missing", enabled: true,
  },
  {
    label: "Solo Queue / ranked",
    kinds: ["soloQueue"],
    source: "riotapi", mode: "future", note: "Integración futura.",
    perVisitCalls: false, minCacheSeconds: 0, onFailure: "omit-and-flag-missing", enabled: false,
  },
];

/** Tabla de responsabilidades (una fila por área del plan). */
export const RESPONSIBILITIES = ROUTES.map((r) => ({
  data: r.label, source: r.source, note: r.note,
})) as readonly { data: string; source: SourceId; note?: string }[];

const BY_KIND = new Map<DataKind, Route>(ROUTES.flatMap((r) => r.kinds.map((k) => [k, r] as const)));

export function routeFor(kind: DataKind): Route {
  const r = BY_KIND.get(kind);
  if (!r) throw new Error(`Tipo de dato sin fuente asignada: ${kind}`);
  return r;
}
export const sourceFor = (kind: DataKind): SourceId => routeFor(kind).source;
export const kindsOf = (source: SourceId): DataKind[] => ROUTES.filter((r) => r.source === source).flatMap((r) => [...r.kinds]);

/**
 * ¿Se puede consultar al proveedor ahora mismo para este dato? Falso para integraciones futuras.
 * `perVisit` indica que la llamada nace de una visita de usuario.
 */
export function canQuery(kind: DataKind, ctx: { perVisit: boolean }): { ok: true } | { ok: false; reason: string } {
  const r = routeFor(kind);
  if (!r.enabled) return { ok: false, reason: `${getSource(r.source).name} aún no está integrada.` };
  if (ctx.perVisit && !r.perVisitCalls) {
    return { ok: false, reason: `${getSource(r.source).name} no puede consultarse por cada visita: usa la copia guardada o la caché larga.` };
  }
  return { ok: true };
}
