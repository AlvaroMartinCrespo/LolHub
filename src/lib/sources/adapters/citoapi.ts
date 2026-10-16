import "server-only";
import { z } from "zod";
import { CITOAPI_BASE_URL, ConfigError, getCitoApiKey } from "@/lib/config/env";
import { DataSourceError } from "@/lib/services/errors";
import type { EntityIdentity, ExternalSeries, SourceMeta, TeamStint } from "@/types/sources";
import { kindsOf } from "../routing";
import { blankToNull, getJson, guardQuery, makeMeta, type FetchLike, type QueryContext, type SourceAdapter } from "./base";

/**
 * Adaptador de CitoAPI (500 llamadas/mes en el plan gratuito → solo para huecos puntuales).
 *
 * Alcance deliberadamente limitado a las respuestas que su documentación muestra con un ejemplo completo
 * (https://citoapi.com/docs/api/league-of-legends/ y /league-of-legends-match-stats-api/, consultadas el 16/10/2026):
 *   - GET /lol/matches/{id}/games      → serie con marcador y mapas
 *   - GET /lol/players/{id}/teams      → historial de equipos de un jugador
 * El resto de endpoints de interés (stats de jugador, roster history, transfers) no tienen ejemplo de respuesta
 * publicado: se auditan con `npm run audit:sources` y se añaden aquí cuando haya una muestra real.
 *
 * Esta capa NO cuenta la cuota: el contador y el bloqueo por margen son el Paso 12.3.3.
 * Mientras tanto la política de 12.2 impide llamarla por visita (`perVisit: false` obligatorio).
 */
export const CITOAPI_DOCUMENTED_ENDPOINTS = ["/lol/matches/{id}/games", "/lol/players/{id}/teams"] as const;

const str = z.string().nullish();

// Envoltorio documentado: { success: true, data: ... }
const envelope = <T extends z.ZodTypeAny>(data: T) => z.object({ success: z.literal(true), data });

const matchGamesSchema = envelope(
  z.object({
    matchId: z.string(),
    bestOf: z.number().nullish(),
    score: z.object({ team1: z.number().nullish(), team2: z.number().nullish() }).nullish(),
    games: z.array(z.object({ gameId: z.string(), winner: str })).nullish(),
  }),
);

const playerTeamsSchema = envelope(
  z.object({
    playerId: z.string(),
    playerName: str,
    teams: z
      .array(z.object({ teamSlug: z.string(), teamName: str, role: str, startedAt: str, endedAt: str }))
      .nullish(),
  }),
);

const toIso = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

const winnerSide = (w: string | null | undefined): 1 | 2 | null => (w === "team1" ? 1 : w === "team2" ? 2 : null);

// ── Transformaciones puras (probadas sin red) ──────────────
export function normalizeMatchGames(body: unknown, meta: SourceMeta): ExternalSeries {
  const r = matchGamesSchema.safeParse(body);
  if (!r.success) throw new DataSourceError("invalid", "CitoAPI: la serie no cumple el esquema documentado");
  const d = r.data.data;
  return {
    meta,
    externalId: d.matchId,
    bestOf: d.bestOf ?? null,
    scoreTeam1: d.score?.team1 ?? null,
    scoreTeam2: d.score?.team2 ?? null,
    games: (d.games ?? []).map((g) => ({ externalId: g.gameId, winnerSide: winnerSide(g.winner) })),
  };
}

export function normalizePlayerTeams(body: unknown, meta: SourceMeta): TeamStint[] {
  const r = playerTeamsSchema.safeParse(body);
  if (!r.success) throw new DataSourceError("invalid", "CitoAPI: el historial de equipos no cumple el esquema documentado");
  const d = r.data.data;
  const name = blankToNull(d.playerName) ?? d.playerId;
  return (d.teams ?? []).map((t) => ({
    meta,
    playerExternalId: d.playerId,
    playerName: name,
    teamExternalId: t.teamSlug,
    teamName: blankToNull(t.teamName) ?? t.teamSlug,
    role: blankToNull(t.role),
    startedAt: toIso(t.startedAt),
    endedAt: toIso(t.endedAt),
    // `endedAt: null` en la documentación equivale a «sigue en el equipo»; si falta el campo no se infiere.
    current: t.endedAt === null ? true : t.endedAt ? false : null,
  }));
}

export const stintIdentities = (stints: TeamStint[]): EntityIdentity[] => {
  const out = new Map<string, EntityIdentity>();
  for (const s of stints) {
    out.set(`team:${s.teamExternalId}`, {
      source: "citoapi", kind: "team", externalId: s.teamExternalId, name: s.teamName, acronym: null, region: null,
    });
    if (s.playerExternalId) {
      out.set(`player:${s.playerExternalId}`, {
        source: "citoapi", kind: "player", externalId: s.playerExternalId, name: s.playerName, acronym: null, region: null,
      });
    }
  }
  return [...out.values()];
};

// ── Adaptador ──────────────────────────────────────────────
export interface CitoApiOptions {
  fetchImpl?: FetchLike;
  apiKey?: string;
  baseUrl?: string;
  now?: () => Date;
}

export interface CitoApiAdapter extends SourceAdapter {
  readonly id: "citoapi";
  /** `ctx` es obligatorio: el llamador declara si la consulta nace de una visita (será rechazada). */
  matchGames(matchId: string, ctx: QueryContext): Promise<ExternalSeries>;
  playerTeams(playerId: string, ctx: QueryContext): Promise<TeamStint[]>;
}

export function createCitoApiAdapter(opts: CitoApiOptions = {}): CitoApiAdapter {
  const base = (opts.baseUrl ?? CITOAPI_BASE_URL).replace(/\/+$/, "");
  const key = (): string => {
    if (opts.apiKey) return opts.apiKey;
    try {
      return getCitoApiKey();
    } catch (e) {
      if (e instanceof ConfigError) throw new DataSourceError("config", e.message);
      throw e;
    }
  };
  // Los identificadores van en la ruta: solo se admiten caracteres seguros.
  const safeId = (id: string): string => {
    if (!/^[A-Za-z0-9._-]{1,128}$/.test(id)) throw new DataSourceError("invalid", "Identificador de CitoAPI no válido");
    return encodeURIComponent(id);
  };
  const call = async (path: string, ctx: QueryContext): Promise<unknown> => {
    // Cuota de 500/mes: nunca por visita de usuario (política de 12.2).
    guardQuery("gapFill", ctx);
    const { body } = await getJson({
      url: new URL(`${base}${path}`),
      headers: { "x-api-key": key() },
      fetchImpl: opts.fetchImpl,
      // Sin reintentos automáticos: cada intento gasta cuota.
      retries: 0,
    });
    return body;
  };
  const now = opts.now ?? (() => new Date());
  return {
    id: "citoapi",
    kinds: kindsOf("citoapi"),
    matchGames: async (matchId, ctx) =>
      normalizeMatchGames(await call(`/lol/matches/${safeId(matchId)}/games`, ctx), makeMeta("citoapi", now)),
    playerTeams: async (playerId, ctx) =>
      normalizePlayerTeams(await call(`/lol/players/${safeId(playerId)}/teams`, ctx), makeMeta("citoapi", now)),
  };
}
