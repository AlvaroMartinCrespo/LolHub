import "server-only";
import type { League, Match, Page, Player, Standing, Team, TeamRef, Tournament } from "@/types/domain";
import type { EntityIdentity } from "@/types/sources";
import * as lol from "@/lib/services/lol";
import { kindsOf } from "../routing";
import { blankToNull, guardQuery, type QueryContext, type SourceAdapter } from "./base";

/**
 * Adaptador de PandaScore (fuente principal). Los servicios del Paso 3 ya devuelven el modelo interno;
 * este adaptador los expone bajo el contrato común, aplica la política de 12.2 y aporta las identidades
 * que la tabla de equivalencias usa como IDs canónicos (el ID numérico de PandaScore).
 */
export interface PandaScoreAdapter extends SourceAdapter {
  readonly id: "pandascore";
  upcomingMatches(o?: lol.ListOptions, ctx?: QueryContext): Promise<Page<Match>>;
  runningMatches(o?: lol.ListOptions, ctx?: QueryContext): Promise<Page<Match>>;
  recentMatches(o?: lol.ListOptions, ctx?: QueryContext): Promise<Page<Match>>;
  match(id: number, ctx?: QueryContext): Promise<Match>;
  team(id: number, ctx?: QueryContext): Promise<Team>;
  player(id: number, ctx?: QueryContext): Promise<Player>;
  leagues(o?: lol.ListOptions, ctx?: QueryContext): Promise<Page<League>>;
  tournaments(o?: lol.ListOptions, ctx?: QueryContext): Promise<Page<Tournament>>;
  standings(tournamentId: number, ctx?: QueryContext): Promise<Standing[]>;
}

// PandaScore sirve las consultas por visita (con la caché de Next del Paso 9), por eso `perVisit` es true por defecto.
const VISIT: QueryContext = { perVisit: true };

export const pandaScoreAdapter: PandaScoreAdapter = {
  id: "pandascore",
  kinds: kindsOf("pandascore"),
  upcomingMatches: (o, ctx = VISIT) => (guardQuery("schedule", ctx), lol.getUpcomingMatches(o)),
  runningMatches: (o, ctx = VISIT) => (guardQuery("schedule", ctx), lol.getRunningMatches(o)),
  recentMatches: (o, ctx = VISIT) => (guardQuery("results", ctx), lol.getRecentMatches(o)),
  match: (id, ctx = VISIT) => (guardQuery("results", ctx), lol.getMatch(id)),
  team: (id, ctx = VISIT) => (guardQuery("teams", ctx), lol.getTeam(id)),
  player: (id, ctx = VISIT) => (guardQuery("players", ctx), lol.getPlayer(id)),
  leagues: (o, ctx = VISIT) => (guardQuery("tournaments", ctx), lol.getLeagues(o)),
  tournaments: (o, ctx = VISIT) => (guardQuery("tournaments", ctx), lol.getTournaments(o)),
  standings: (id, ctx = VISIT) => (guardQuery("tournaments", ctx), lol.getTournamentStandings(id)),
};

// ── Identidades (puras) ────────────────────────────────────
export const teamIdentity = (t: Team | TeamRef): EntityIdentity => ({
  source: "pandascore",
  kind: "team",
  externalId: String(t.id),
  name: t.name,
  acronym: t.acronym,
  region: "region" in t ? t.region : blankToNull(t.location),
});

export const playerIdentity = (p: Player): EntityIdentity => ({
  source: "pandascore",
  kind: "player",
  externalId: String(p.id),
  name: p.name,
  acronym: null,
  region: p.nationality,
});

export const tournamentIdentity = (t: Tournament): EntityIdentity => ({
  source: "pandascore",
  kind: "tournament",
  externalId: String(t.id),
  name: t.name,
  acronym: null,
  region: null,
});

export const leagueIdentity = (l: League): EntityIdentity => ({
  source: "pandascore",
  kind: "league",
  externalId: String(l.id),
  name: l.name,
  acronym: l.slug,
  region: null,
});
