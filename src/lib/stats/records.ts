import type { Match } from "@/types/domain";

export interface GameRecord { seconds: number; matchId: number }
export interface TeamRecords {
  /** Series contadas (finalizadas, sin incomparecencia, con ganador) */
  series: number;
  longestWinStreak: number;
  longestLossStreak: number;
  longestGame: GameRecord | null;
  shortestGame: GameRecord | null;
  /** Mayor diferencia de mapas en una serie ganada */
  biggestWin: { matchId: number; margin: number; score: string } | null;
}

const when = (m: Match) => new Date(m.endTime ?? m.startTime ?? 0).getTime();

/**
 * Récords sobre las series dadas (filtra antes por temporada/torneo para «récords de temporada»).
 * Rachas: series consecutivas en orden cronológico. Partidas: solo con duración > 0.
 */
export function computeRecords(matches: Match[], teamId: number): TeamRecords {
  const counted = matches
    .filter((m) => m.status === "finished" && !m.forfeit && m.winnerTeamId !== null && m.sides?.some((s) => s.team.id === teamId))
    .sort((a, b) => when(a) - when(b));

  let win = 0, loss = 0, bestWin = 0, bestLoss = 0;
  let longest: GameRecord | null = null;
  let shortest: GameRecord | null = null;
  let biggest: TeamRecords["biggestWin"] = null;

  for (const m of counted) {
    if (m.winnerTeamId === teamId) { win++; loss = 0; } else { loss++; win = 0; }
    bestWin = Math.max(bestWin, win);
    bestLoss = Math.max(bestLoss, loss);

    for (const g of m.games) {
      if (g.status !== "finished" || g.forfeit || g.durationSeconds === null || g.durationSeconds <= 0) continue;
      if (!longest || g.durationSeconds > longest.seconds) longest = { seconds: g.durationSeconds, matchId: m.id };
      if (!shortest || g.durationSeconds < shortest.seconds) shortest = { seconds: g.durationSeconds, matchId: m.id };
    }

    if (m.winnerTeamId === teamId) {
      const mine = m.sides!.find((s) => s.team.id === teamId)!.score;
      const theirs = m.sides!.find((s) => s.team.id !== teamId)?.score;
      if (mine !== null && theirs !== null && theirs !== undefined) {
        const margin = mine - theirs;
        if (!biggest || margin >= biggest.margin) biggest = { matchId: m.id, margin, score: `${mine}–${theirs}` };
      }
    }
  }
  return { series: counted.length, longestWinStreak: bestWin, longestLossStreak: bestLoss, longestGame: longest, shortestGame: shortest, biggestWin: biggest };
}
