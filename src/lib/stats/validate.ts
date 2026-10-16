import type { Match } from "@/types/domain";
import type { TeamStats } from "./formulas";

export interface ConsistencyReport {
  /** Series con marcador y mapas disponibles que se pudieron cruzar */
  crossChecked: number;
  /** Series cuyo marcador no coincide con los mapas ganados */
  mismatches: number;
  /** wins + losses == series contadas */
  totalsOk: boolean;
  ok: boolean;
}

/**
 * Comprueba que los cálculos son coherentes con los datos de origen:
 * 1) wins + losses coincide con las series contadas;
 * 2) por serie, el marcador del equipo coincide con los mapas que ganó.
 */
export function checkConsistency(matches: Match[], stats: TeamStats): ConsistencyReport {
  let crossChecked = 0;
  let mismatches = 0;

  for (const m of matches) {
    if (m.status !== "finished" || m.forfeit || m.winnerTeamId === null) continue;
    const side = m.sides?.find((s) => s.team.id === stats.teamId);
    if (!side || side.score === null) continue;
    const finished = m.games.filter((g) => g.status === "finished" && !g.forfeit && g.winnerTeamId !== null);
    if (finished.length === 0) continue;
    crossChecked++;
    const gameWins = finished.filter((g) => g.winnerTeamId === stats.teamId).length;
    if (gameWins !== side.score) mismatches++;
  }

  const totalsOk = stats.series.wins + stats.series.losses === stats.sample.series;
  return { crossChecked, mismatches, totalsOk, ok: totalsOk && mismatches === 0 };
}
