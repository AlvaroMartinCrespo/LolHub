import type { Match } from "@/types/domain";

/** Mínimo de series para considerar fiable un porcentaje y mostrar gráficos. */
export const MIN_SAMPLE = 10;

export type FormResult = "W" | "L";

export interface Record2 {
  wins: number;
  losses: number;
  /** % de victorias = wins / (wins + losses) × 100; null si no hay muestra */
  winRate: number | null;
}

export interface TeamStats {
  teamId: number;
  series: Record2;
  maps: Record2;
  /** Últimos 5 resultados de serie, del más reciente al más antiguo */
  form: FormResult[];
  sample: {
    series: number;
    maps: number;
    /** Fechas (ISO) de la serie más antigua y la más reciente contadas */
    from: string | null;
    to: string | null;
    excluded: { notFinished: number; forfeit: number; noWinner: number };
  };
  /** Nº de series por formato (al mejor de N) */
  formats: Record<string, number>;
  mixedFormats: boolean;
  reliable: boolean;
}

export const ratio = (wins: number, losses: number): number | null => {
  const t = wins + losses;
  return t > 0 ? (wins / t) * 100 : null;
};

const when = (m: Match) => m.endTime ?? m.startTime;
const ts = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

/**
 * Métricas de un equipo a partir de sus partidos.
 * - Serie contada: finalizada, sin incomparecencia y con ganador conocido.
 * - Victoria de serie: winnerTeamId === teamId; derrota: ganador distinto.
 * - Mapa contado: partida finalizada con ganador, dentro de una serie no decidida por incomparecencia.
 * Fórmulas completas: docs/estadisticas.md
 */
export function computeTeamStats(matches: Match[], teamId: number): TeamStats {
  const excluded = { notFinished: 0, forfeit: 0, noWinner: 0 };
  let sw = 0, sl = 0, mw = 0, ml = 0;
  const counted: { m: Match; won: boolean }[] = [];

  for (const m of matches) {
    if (!m.sides?.some((s) => s.team.id === teamId)) continue;
    if (m.status !== "finished") { excluded.notFinished++; continue; }
    if (m.forfeit) { excluded.forfeit++; continue; }
    if (m.winnerTeamId === null) { excluded.noWinner++; continue; }

    const won = m.winnerTeamId === teamId;
    if (won) sw++; else sl++;
    counted.push({ m, won });

    for (const g of m.games) {
      if (g.status !== "finished" || g.forfeit || g.winnerTeamId === null) continue;
      if (g.winnerTeamId === teamId) mw++; else ml++;
    }
  }

  const byTimeDesc = [...counted].sort((a, b) => ts(when(b.m)) - ts(when(a.m)));
  const dated = byTimeDesc.map((c) => when(c.m)).filter((x): x is string => !!x);
  const formats: Record<string, number> = {};
  for (const { m } of counted) {
    const k = m.bestOf !== null ? `Bo${m.bestOf}` : "Sin dato";
    formats[k] = (formats[k] ?? 0) + 1;
  }

  return {
    teamId,
    series: { wins: sw, losses: sl, winRate: ratio(sw, sl) },
    maps: { wins: mw, losses: ml, winRate: ratio(mw, ml) },
    form: byTimeDesc.slice(0, 5).map((c): FormResult => (c.won ? "W" : "L")),
    sample: {
      series: counted.length,
      maps: mw + ml,
      from: dated.length ? dated[dated.length - 1] : null,
      to: dated.length ? dated[0] : null,
      excluded,
    },
    formats,
    mixedFormats: Object.keys(formats).length > 1,
    reliable: counted.length >= MIN_SAMPLE,
  };
}
