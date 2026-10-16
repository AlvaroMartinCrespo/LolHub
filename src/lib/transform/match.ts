import type { GameResult, GameStatus, Match, MatchSide, MatchStatus, TeamRef } from "@/types/domain";
import type { PsMatch } from "@/types/pandascore";
import { clean, toIso } from "./common";

export function normalizeMatchStatus(status: string | null | undefined): MatchStatus {
  switch (status) {
    case "not_started": return "scheduled";
    case "running": return "live";
    case "finished": return "finished";
    case "postponed": return "postponed";
    case "canceled": return "canceled";
    default: return "unknown";
  }
}

function normalizeGameStatus(status: string | null | undefined): GameStatus {
  if (status === "not_started" || status === "running" || status === "finished") return status;
  return "unknown";
}

export function normalizeMatch(m: PsMatch): Match {
  const opponents = m.opponents ?? [];
  const results = m.results ?? [];

  const toSide = (o: (typeof opponents)[number]): MatchSide => {
    const t = o.opponent;
    const team: TeamRef = {
      id: t.id,
      name: clean(t.name) ?? clean(t.acronym) ?? "Por determinar",
      acronym: clean(t.acronym),
      imageUrl: clean(t.image_url),
      location: clean(t.location),
    };
    const r = results.find((x) => x.team_id === t.id);
    return { team, score: typeof r?.score === "number" ? r.score : null };
  };

  const sides: Match["sides"] = opponents.length >= 2 ? [toSide(opponents[0]), toSide(opponents[1])] : null;

  const games: GameResult[] = (m.games ?? [])
    .map((g) => ({
      id: g.id,
      position: g.position ?? null,
      status: normalizeGameStatus(g.status),
      winnerTeamId: g.winner?.id ?? null,
      durationSeconds: typeof g.length === "number" ? g.length : null,
      startedAt: toIso(g.begin_at),
      endedAt: toIso(g.end_at),
      forfeit: g.forfeit === true,
    }))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const league = m.league && m.league.id != null
    ? { id: m.league.id, name: clean(m.league.name) ?? "Liga", slug: clean(m.league.slug), imageUrl: clean(m.league.image_url) }
    : null;

  return {
    id: m.id,
    name: clean(m.name) ?? "Partido",
    status: normalizeMatchStatus(m.status),
    startTime: toIso(m.begin_at) ?? toIso(m.scheduled_at),
    endTime: toIso(m.end_at),
    bestOf: m.number_of_games ?? null,
    league,
    serieName: clean(m.serie?.full_name) ?? clean(m.serie?.name),
    tournamentName: clean(m.tournament?.name),
    tournamentId: m.tournament?.id ?? null,
    sides,
    winnerTeamId: m.winner_id ?? null,
    forfeit: m.forfeit === true,
    games,
  };
}
