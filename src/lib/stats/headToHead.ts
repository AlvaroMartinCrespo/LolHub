import type { Match } from "@/types/domain";

export interface HeadToHead {
  /** Series finalizadas entre ambos, la más reciente primero */
  matches: Match[];
  aWins: number;
  bWins: number;
  /** Series sin ganador conocido o por incomparecencia (listadas, pero no cuentan) */
  notCounted: number;
  mapsA: number;
  mapsB: number;
}

const when = (m: Match) => new Date(m.endTime ?? m.startTime ?? 0).getTime();

/** Enfrentamientos directos a partir de partidos de uno o ambos equipos (se deduplica por id). */
export function computeHeadToHead(matches: Match[], aId: number, bId: number): HeadToHead {
  const byId = new Map<number, Match>();
  for (const m of matches) {
    const ids = m.sides?.map((s) => s.team.id) ?? [];
    if (m.status === "finished" && ids.includes(aId) && ids.includes(bId)) byId.set(m.id, m);
  }
  const list = [...byId.values()].sort((x, y) => when(y) - when(x));
  let aWins = 0, bWins = 0, notCounted = 0, mapsA = 0, mapsB = 0;
  for (const m of list) {
    if (m.forfeit || m.winnerTeamId === null) { notCounted++; continue; }
    if (m.winnerTeamId === aId) aWins++;
    else if (m.winnerTeamId === bId) bWins++;
    else notCounted++;
    for (const g of m.games) {
      if (g.status !== "finished" || g.forfeit) continue;
      if (g.winnerTeamId === aId) mapsA++;
      else if (g.winnerTeamId === bId) mapsB++;
    }
  }
  return { matches: list, aWins, bWins, notCounted, mapsA, mapsB };
}
