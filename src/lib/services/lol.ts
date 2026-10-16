import "server-only";
import type { League, Match, Page, Player, Standing, Team, Tournament } from "@/types/domain";
import {
  psLeagueSchema, psMatchSchema, psPlayerSchema, psStandingSchema, psTeamSchema, psTournamentSchema,
} from "@/lib/schemas/pandascore";
import { normalizeLeague, normalizePlayer, normalizeStanding, normalizeTeam, normalizeTournament } from "@/lib/transform/entities";
import { normalizeMatch } from "@/lib/transform/match";
import type { RevalidateKind } from "@/lib/cache/revalidate";
import { pandaScoreFetch, parseList, parseOne } from "./pandascore-client";
import type { z } from "zod";

export interface ListOptions {
  page?: number;
  perPage?: number;
  /** Filtros de PandaScore: p. ej. { "filter[league_id]": "293" } */
  filters?: Record<string, string | number>;
}

const MAX_PER_PAGE = 100;

async function list<S extends z.ZodTypeAny, T>(
  path: string,
  schema: S,
  map: (raw: z.infer<S>) => T,
  kind: RevalidateKind,
  opts: ListOptions & { sort?: string } = {},
): Promise<Page<T>> {
  const page = Math.max(1, opts.page ?? 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, opts.perPage ?? 50));
  const params: Record<string, string | number> = {
    "page[number]": page,
    "page[size]": perPage,
    ...(opts.sort ? { sort: opts.sort } : {}),
    ...opts.filters,
  };
  const res = await pandaScoreFetch(path, params, kind);
  const { items, skipped } = parseList(res.body, schema);
  return { items: items.map(map), page: res.page ?? page, perPage: res.perPage ?? perPage, total: res.total, skipped };
}

async function one<S extends z.ZodTypeAny, T>(
  path: string, schema: S, map: (raw: z.infer<S>) => T, kind: RevalidateKind,
): Promise<T> {
  const res = await pandaScoreFetch(path, {}, kind);
  return map(parseOne(res.body, schema));
}

// ── Catálogo ───────────────────────────────────────────────
export const getLeagues = (o?: ListOptions): Promise<Page<League>> =>
  list("/lol/leagues", psLeagueSchema, normalizeLeague, "catalog", { ...o, sort: "name" });

export const getUpcomingTournaments = (o?: ListOptions): Promise<Page<Tournament>> =>
  list("/lol/tournaments/upcoming", psTournamentSchema, normalizeTournament, "catalog", o);

// ── Partidos ───────────────────────────────────────────────
export const getUpcomingMatches = (o?: ListOptions): Promise<Page<Match>> =>
  list("/lol/matches/upcoming", psMatchSchema, normalizeMatch, "upcoming", { ...o, sort: "scheduled_at" });

export const getRunningMatches = (o?: ListOptions): Promise<Page<Match>> =>
  list("/lol/matches/running", psMatchSchema, normalizeMatch, "running", o);

export const getRecentMatches = (o?: ListOptions, kind: RevalidateKind = "finished"): Promise<Page<Match>> =>
  list("/lol/matches/past", psMatchSchema, normalizeMatch, kind, { ...o, sort: "-end_at" });

export const getMatch = (id: number): Promise<Match> =>
  one(`/lol/matches/${id}`, psMatchSchema, normalizeMatch, "detail");

// ── Equipos y jugadores ────────────────────────────────────
export const getTeam = (id: number): Promise<Team> =>
  one(`/lol/teams/${id}`, psTeamSchema, normalizeTeam, "catalog");

export const getPlayer = (id: number): Promise<Player> =>
  one(`/lol/players/${id}`, psPlayerSchema, normalizePlayer, "catalog");

// ── Competiciones ──────────────────────────────────────────
export const getLeague = (id: number): Promise<League> =>
  one(`/lol/leagues/${id}`, psLeagueSchema, normalizeLeague, "catalog");

export const getTournament = (id: number): Promise<Tournament> =>
  one(`/lol/tournaments/${id}`, psTournamentSchema, normalizeTournament, "catalog");

/** Torneos (fases) más recientes primero. Filtra con { "filter[league_id]": id }. */
export const getTournaments = (o?: ListOptions): Promise<Page<Tournament>> =>
  list("/lol/tournaments", psTournamentSchema, normalizeTournament, "catalog", { ...o, sort: "-begin_at" });

export async function getTournamentStandings(id: number): Promise<Standing[]> {
  const res = await pandaScoreFetch(`/lol/tournaments/${id}/standings`, {}, "catalog");
  const { items } = parseList(res.body, psStandingSchema);
  return items
    .map(normalizeStanding)
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
}

// ── Filtros de partidos por entidad ────────────────────────
export const byTeam = (id: number) => ({ "filter[opponent_id]": id });
export const byLeague = (id: number) => ({ "filter[league_id]": id });
export const byTournament = (id: number) => ({ "filter[tournament_id]": id });

// ── Estadísticas ───────────────────────────────────────────
export interface TeamHistory {
  matches: Match[];
  /** true si puede haber partidos más antiguos que no se cargaron */
  truncated: boolean;
}

/** Hasta `maxPages` páginas (100 partidos cada una) de resultados pasados de un equipo. */
export async function getTeamHistory(id: number, maxPages = 3): Promise<TeamHistory> {
  const matches: Match[] = [];
  let truncated = false;
  for (let page = 1; page <= maxPages; page++) {
    const res = await getRecentMatches({ perPage: 100, page, filters: byTeam(id) }, "historical");
    matches.push(...res.items);
    const full = res.items.length + res.skipped >= res.perPage;
    if (!full) break;
    if (page === maxPages) truncated = true;
  }
  return { matches, truncated };
}

export const searchTeams = (query: string): Promise<Page<Team>> =>
  list("/lol/teams", psTeamSchema, normalizeTeam, "catalog", {
    perPage: 8,
    filters: { "search[name]": query.slice(0, 60) },
  });

// ── Búsqueda, calendario e internacionales ─────────────────
export const searchPlayers = (query: string): Promise<Page<Player>> =>
  list("/lol/players", psPlayerSchema, normalizePlayer, "catalog", {
    perPage: 8,
    filters: { "search[name]": query.slice(0, 60) },
  });

export const searchLeagues = (query: string, perPage = 8): Promise<Page<League>> =>
  list("/lol/leagues", psLeagueSchema, normalizeLeague, "catalog", {
    perPage,
    filters: { "search[name]": query.slice(0, 60) },
  });

export interface MatchesWindow {
  matches: Match[];
  /** true si la ventana tenía más partidos de los cargados */
  truncated: boolean;
}

/** Partidos (cualquier estado) con `scheduled_at` dentro de la ventana, hasta `maxPages` × 100. */
export async function getMatchesBetween(
  fromIso: string, toIso: string, kind: RevalidateKind = "upcoming", maxPages = 2,
): Promise<MatchesWindow> {
  const matches: Match[] = [];
  let truncated = false;
  for (let page = 1; page <= maxPages; page++) {
    const res = await list("/lol/matches", psMatchSchema, normalizeMatch, kind, {
      page, perPage: 100, sort: "scheduled_at", filters: { "range[scheduled_at]": `${fromIso},${toIso}` },
    });
    matches.push(...res.items);
    if (res.items.length + res.skipped < res.perPage) break;
    if (page === maxPages) truncated = true;
  }
  return { matches, truncated };
}
