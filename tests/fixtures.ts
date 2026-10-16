// Datos SINTÉTICOS solo para pruebas. Nunca se importan desde src/.
import type { Match, TeamRef } from "@/types/domain";

export const team = (id: number, name: string, location: string | null = null): TeamRef => ({
  id, name, acronym: name.slice(0, 3).toUpperCase(), imageUrl: null, location,
});

let gameId = 0;
export function makeMatch(over: Partial<Match> & { id: number }): Match {
  const a = team(1, "Alpha", "ES");
  const b = team(2, "Beta", "KR");
  return {
    name: `${a.name} vs ${b.name}`,
    status: "scheduled",
    startTime: null,
    endTime: null,
    bestOf: 3,
    league: { id: 1, name: "Liga Uno", slug: null, imageUrl: null },
    serieName: "Temporada 1",
    tournamentName: "Playoffs",
    tournamentId: 10,
    sides: [{ team: a, score: null }, { team: b, score: null }],
    winnerTeamId: null,
    forfeit: false,
    games: [],
    ...over,
  };
}

/** Serie finalizada con marcador y mapas coherentes. */
export function finished(id: number, winnerId: 1 | 2, scoreA: number, scoreB: number, over: Partial<Match> = {}): Match {
  const games = [
    ...Array.from({ length: scoreA }, () => 1),
    ...Array.from({ length: scoreB }, () => 2),
  ].map((w, i) => ({
    id: ++gameId, position: i + 1, status: "finished" as const, winnerTeamId: w,
    durationSeconds: 1800, startedAt: null, endedAt: null, forfeit: false,
  }));
  return makeMatch({
    id,
    status: "finished",
    endTime: new Date(2026, 8, id).toISOString(),
    winnerTeamId: winnerId,
    sides: [{ team: team(1, "Alpha", "ES"), score: scoreA }, { team: team(2, "Beta", "KR"), score: scoreB }],
    games,
    ...over,
  });
}

/** Partido crudo con el formato de PandaScore (sintético). */
export function rawMatch(id: number, over: Record<string, unknown> = {}) {
  return {
    id, name: `Match ${id}`, status: "not_started",
    scheduled_at: "2026-10-20T18:00:00Z", begin_at: null, end_at: null, number_of_games: 3,
    league: { id: 1, name: "Liga Uno" }, serie: { id: 5, full_name: "Temporada 1" }, tournament: { id: 10, name: "Playoffs" },
    opponents: [
      { type: "Team", opponent: { id: 1, name: "Alpha", acronym: "ALP", location: "ES" } },
      { type: "Team", opponent: { id: 2, name: "Beta", acronym: "BET", location: "KR" } },
    ],
    results: [{ team_id: 1, score: 0 }, { team_id: 2, score: 0 }],
    games: [],
    ...over,
  };
}
