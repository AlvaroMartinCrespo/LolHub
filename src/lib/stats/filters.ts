import type { Match } from "@/types/domain";
import type { Period } from "@/lib/filters/types";
import { matchesPeriod } from "@/lib/filters/matches";

export interface StatsFilters {
  period: Period;
  /** nombre de torneo ("" = todos) */
  tournament: string;
  /** nombre de temporada/serie ("" = todas) */
  season: string;
  /** formato al mejor de N ("" = todos) */
  bestOf: string;
}

export const EMPTY_STATS_FILTERS: StatsFilters = { period: "all", tournament: "", season: "", bestOf: "" };

const PERIODS: Period[] = ["all", "7d", "30d", "90d"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseStatsFilters(sp: Record<string, string | string[] | undefined>): StatsFilters {
  const period = one(sp.period) as Period;
  const bestOf = one(sp.bestOf);
  return {
    period: PERIODS.includes(period) ? period : "all",
    tournament: one(sp.tournament).slice(0, 120),
    season: one(sp.season).slice(0, 120),
    bestOf: /^\d{1,2}$/.test(bestOf) ? bestOf : "",
  };
}

export function applyStatsFilters(matches: Match[], f: StatsFilters, now = new Date()): Match[] {
  return matches.filter((m) => {
    if (f.tournament && m.tournamentName !== f.tournament) return false;
    if (f.season && m.serieName !== f.season) return false;
    if (f.bestOf && String(m.bestOf) !== f.bestOf) return false;
    return matchesPeriod(m.endTime ?? m.startTime, f.period, now);
  });
}

export interface StatsFilterOptions {
  tournaments: string[];
  seasons: string[];
  formats: string[];
}

export function buildStatsOptions(matches: Match[]): StatsFilterOptions {
  const t = new Set<string>(), s = new Set<string>(), b = new Set<string>();
  for (const m of matches) {
    if (m.tournamentName) t.add(m.tournamentName);
    if (m.serieName) s.add(m.serieName);
    if (m.bestOf !== null) b.add(String(m.bestOf));
  }
  const sort = (x: Set<string>) => [...x].sort((a, c) => a.localeCompare(c, "es", { numeric: true }));
  return { tournaments: sort(t), seasons: sort(s), formats: sort(b) };
}

export const hasStatsFilters = (f: StatsFilters) =>
  f.period !== "all" || !!f.tournament || !!f.season || !!f.bestOf;
