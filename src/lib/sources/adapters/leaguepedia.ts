import "server-only";
import { z } from "zod";
import { LEAGUEPEDIA_API_URL } from "@/lib/config/env";
import { DataSourceError } from "@/lib/services/errors";
import type { EntityIdentity, ExternalTeam, SourceMeta, TeamStint } from "@/types/sources";
import { kindsOf } from "../routing";
import { blankToNull, getJson, guardQuery, makeMeta, type FetchLike, type QueryContext, type SourceAdapter } from "./base";

/**
 * Adaptador de Leaguepedia (Cargo API de lol.fandom.com). Licencia CC-BY-SA: atribuir siempre.
 *
 * Campos usados y su estado de verificación (16/10/2026):
 *  - Teams: Name, OverviewPage, Short, Location, Region, Image, IsDisbanded → VERIFICADOS en la declaración
 *    pública `Module:CargoDeclare/Teams`.
 *  - Tenures: Player, Team, IsCurrent → verificados por un ejemplo oficial de consulta (Module:CargoQuery);
 *    DateJoin, DateLeave, Role → PENDIENTES de confirmar con `npm run audit:sources` (cargofields).
 *    Si alguno no existe, Cargo devuelve un error y el adaptador lo reporta como `invalid` sin inventar datos.
 *
 * El acceso anónimo está muy limitado (≈1 consulta por minuto y 500 filas por página según los informes de otros
 * proyectos) y el error de límite llega dentro de un HTTP 200. Aquí solo se DETECTA ese error; la gestión de
 * cuota, espera y reintentos es el Paso 12.3.3. Sin reintentos automáticos: reintentar dentro del límite lo alarga.
 */
export const LEAGUEPEDIA_FIELDS = {
  Teams: { verified: ["Name", "OverviewPage", "Short", "Location", "Region", "Image", "IsDisbanded"], unverified: [] },
  Tenures: { verified: ["Player", "Team", "IsCurrent"], unverified: ["DateJoin", "DateLeave", "Role"] },
} as const;

export const ANON_ROW_LIMIT = 500;

// Cargo devuelve todos los valores como cadenas (los vacíos, como "" o ausentes).
const cell = z.string().nullish();
const rowsSchema = <S extends z.ZodRawShape>(shape: S) =>
  z.object({ cargoquery: z.array(z.object({ title: z.object(shape).passthrough() })) });

const teamsBody = rowsSchema({
  Name: z.string(), OverviewPage: cell, Short: cell, Location: cell, Region: cell, Image: cell, IsDisbanded: cell,
});
const tenuresBody = rowsSchema({
  Player: z.string(), Team: z.string(), IsCurrent: cell, DateJoin: cell, DateLeave: cell, Role: cell,
});

/** Detecta los errores que MediaWiki devuelve con HTTP 200. */
export function assertNoApiError(body: unknown): void {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error?: { code?: unknown } }).error;
    const code = typeof e?.code === "string" ? e.code : "desconocido";
    throw new DataSourceError(code === "ratelimited" ? "rate_limited" : "invalid", `Leaguepedia respondió con error (${code})`, 200);
  }
}

const bool = (v: string | null | undefined): boolean | null => (v === "1" ? true : v === "0" ? false : null);

/** Fechas de Cargo: «YYYY-MM-DD» o «YYYY-MM-DD HH:MM:SS» en UTC. Todo lo demás se descarta. */
export function cargoDateToIso(v: string | null | undefined): string | null {
  const t = v?.trim();
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/.exec(t);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)));
  return Number.isNaN(d.getTime()) || d.getUTCMonth() !== +m[2] - 1 ? null : d.toISOString();
}

export function normalizeTeams(body: unknown, meta: SourceMeta): ExternalTeam[] {
  assertNoApiError(body);
  const r = teamsBody.safeParse(body);
  if (!r.success) throw new DataSourceError("invalid", "Leaguepedia: la respuesta de Teams no cumple el esquema esperado");
  return r.data.cargoquery.map(({ title: t }) => ({
    meta,
    // OverviewPage es el identificador recomendado por la propia declaración; Name es el respaldo.
    externalId: blankToNull(t.OverviewPage) ?? t.Name,
    name: t.Name,
    acronym: blankToNull(t.Short),
    region: blankToNull(t.Region),
    location: blankToNull(t.Location),
    disbanded: bool(t.IsDisbanded),
    logoFile: blankToNull(t.Image),
  }));
}

export function normalizeTenures(body: unknown, meta: SourceMeta): TeamStint[] {
  assertNoApiError(body);
  const r = tenuresBody.safeParse(body);
  if (!r.success) throw new DataSourceError("invalid", "Leaguepedia: la respuesta de Tenures no cumple el esquema esperado");
  return r.data.cargoquery.map(({ title: t }) => ({
    meta,
    // Leaguepedia identifica a los jugadores por su ID (nombre de página): no hay un identificador numérico.
    playerExternalId: t.Player,
    playerName: t.Player,
    teamExternalId: t.Team,
    teamName: t.Team,
    role: blankToNull(t.Role),
    startedAt: cargoDateToIso(t.DateJoin),
    endedAt: cargoDateToIso(t.DateLeave),
    current: bool(t.IsCurrent),
  }));
}

export const teamIdentity = (t: ExternalTeam): EntityIdentity => ({
  source: "leaguepedia", kind: "team", externalId: t.externalId, name: t.name, acronym: t.acronym, region: t.region,
});

/**
 * URL del archivo de imagen de la wiki. Úsala solo con permiso: los logos pertenecen a cada equipo y
 * las imágenes de Leaguepedia no siempre comparten la licencia CC-BY-SA del texto.
 */
export const leaguepediaFileUrl = (file: string): string =>
  `https://lol.fandom.com/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}`;

/** Un valor para un `where` de Cargo entre comillas dobles. Se rechaza lo que no se pueda citar con seguridad. */
export function cargoString(value: string): string {
  if (!value.trim() || value.length > 120 || /["\\\u0000-\u001f]/.test(value)) {
    throw new DataSourceError("invalid", "Valor no válido para una consulta a Leaguepedia");
  }
  return `"${value}"`;
}

export interface LeaguepediaOptions {
  fetchImpl?: FetchLike;
  apiUrl?: string;
  now?: () => Date;
  /** Máximo de filas por consulta (≤ 500 en acceso anónimo). */
  limit?: number;
}

export interface LeaguepediaAdapter extends SourceAdapter {
  readonly id: "leaguepedia";
  teamsByName(name: string, ctx: QueryContext): Promise<ExternalTeam[]>;
  teamsByRegion(region: string, ctx: QueryContext): Promise<ExternalTeam[]>;
  teamTenures(teamPage: string, ctx: QueryContext): Promise<TeamStint[]>;
}

export function createLeaguepediaAdapter(opts: LeaguepediaOptions = {}): LeaguepediaAdapter {
  const api = opts.apiUrl ?? LEAGUEPEDIA_API_URL;
  const limit = Math.min(ANON_ROW_LIMIT, Math.max(1, opts.limit ?? ANON_ROW_LIMIT));
  const now = opts.now ?? (() => new Date());
  const query = async (table: "Teams" | "Tenures", fields: readonly string[], where: string, ctx: QueryContext): Promise<unknown> => {
    guardQuery(table === "Teams" ? "teamLogos" : "rosters", ctx);
    const url = new URL(api);
    url.searchParams.set("action", "cargoquery");
    url.searchParams.set("format", "json");
    url.searchParams.set("tables", table);
    url.searchParams.set("fields", fields.join(","));
    url.searchParams.set("where", where);
    url.searchParams.set("limit", String(limit));
    // `maxlag` es la cortesía que Fandom pide a los bots: si la réplica va retrasada, el servidor rechaza la consulta.
    url.searchParams.set("maxlag", "5");
    const { body } = await getJson({ url, fetchImpl: opts.fetchImpl, retries: 0 });
    return body;
  };
  const teamFields = [...LEAGUEPEDIA_FIELDS.Teams.verified];
  const tenureFields = [...LEAGUEPEDIA_FIELDS.Tenures.verified, ...LEAGUEPEDIA_FIELDS.Tenures.unverified];
  return {
    id: "leaguepedia",
    kinds: kindsOf("leaguepedia"),
    teamsByName: async (name, ctx) =>
      normalizeTeams(await query("Teams", teamFields, `Name=${cargoString(name)}`, ctx), makeMeta("leaguepedia", now)),
    teamsByRegion: async (region, ctx) =>
      normalizeTeams(await query("Teams", teamFields, `Region=${cargoString(region)}`, ctx), makeMeta("leaguepedia", now)),
    teamTenures: async (teamPage, ctx) =>
      normalizeTenures(await query("Tenures", tenureFields, `Team=${cargoString(teamPage)}`, ctx), makeMeta("leaguepedia", now)),
  };
}
