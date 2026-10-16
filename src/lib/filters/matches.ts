import type { Match } from "@/types/domain";
import type { DateFilterValue, MatchCriteria, Period } from "./types";

export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const startOfLocalDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** ¿La fecha ISO cae en el filtro de fecha? Usa días en la zona horaria local. */
export function matchesDate(iso: string | null, f: DateFilterValue, now: Date): boolean {
  if (f.preset === "all") return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const today = startOfLocalDay(now);
  if (f.preset === "today") return t >= today.getTime() && t < addDays(today, 1).getTime();
  if (f.preset === "next7") return t >= today.getTime() && t < addDays(today, 7).getTime();
  if (f.preset === "date" && f.date) {
    const [y, m, d] = f.date.split("-").map(Number);
    if (!y || !m || !d) return true;
    const day = new Date(y, m - 1, d);
    return t >= day.getTime() && t < addDays(day, 1).getTime();
  }
  return true;
}

const PERIOD_DAYS: Record<Exclude<Period, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function matchesPeriod(iso: string | null, period: Period, now: Date): boolean {
  if (period === "all") return true;
  if (!iso) return false;
  return new Date(iso).getTime() >= addDays(now, -PERIOD_DAYS[period]).getTime();
}

export function matchRegions(m: Match): string[] {
  return (m.sides ?? []).map((s) => s.team.location).filter((x): x is string => !!x);
}

function searchHaystack(m: Match): string {
  const parts = [m.name, m.league?.name, m.tournamentName, m.serieName];
  for (const s of m.sides ?? []) parts.push(s.team.name, s.team.acronym);
  return normalizeText(parts.filter(Boolean).join(" "));
}

const inList = (list: string[], v: string | null | undefined) => list.length === 0 || (v != null && list.includes(v));

export function filterMatches(matches: Match[], c: MatchCriteria, now: Date = new Date()): Match[] {
  const q = normalizeText(c.query);
  return matches.filter((m) => {
    if (!inList(c.leagueIds, m.league ? String(m.league.id) : null)) return false;
    if (c.regions.length > 0 && !matchRegions(m).some((r) => c.regions.includes(r))) return false;
    if (c.teamIds.length > 0 && !(m.sides ?? []).some((s) => c.teamIds.includes(String(s.team.id)))) return false;
    if (!inList(c.tournaments, m.tournamentName)) return false;
    if (!matchesDate(m.startTime, c.date, now)) return false;
    if (!matchesPeriod(m.endTime ?? m.startTime, c.period, now)) return false;
    if (q && !searchHaystack(m).includes(q)) return false;
    return true;
  });
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

/** Próximos: directos primero; luego cronológico ascendente; sin fecha al final. */
export function sortUpcoming(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    if ((a.status === "live") !== (b.status === "live")) return a.status === "live" ? -1 : 1;
    const ta = time(a.startTime), tb = time(b.startTime);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
}

/** Resultados: más recientes primero. */
export function sortRecent(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => (time(b.endTime ?? b.startTime) ?? 0) - (time(a.endTime ?? a.startTime) ?? 0));
}

export interface FilterOption { value: string; label: string }

const byLabel = (a: FilterOption, b: FilterOption) => a.label.localeCompare(b.label, "es");

export function buildOptions(matches: Match[]) {
  const leagues = new Map<string, string>();
  const teams = new Map<string, string>();
  const regions = new Set<string>();
  const tournaments = new Set<string>();
  for (const m of matches) {
    if (m.league) leagues.set(String(m.league.id), m.league.name);
    if (m.tournamentName) tournaments.add(m.tournamentName);
    for (const s of m.sides ?? []) teams.set(String(s.team.id), s.team.name);
    for (const r of matchRegions(m)) regions.add(r);
  }
  const toOpts = (map: Map<string, string>) => [...map].map(([value, label]) => ({ value, label })).sort(byLabel);
  return {
    leagues: toOpts(leagues),
    teams: toOpts(teams),
    regions: [...regions].map((r) => ({ value: r, label: r })).sort(byLabel),
    tournaments: [...tournaments].map((t) => ({ value: t, label: t })).sort(byLabel),
  };
}

export function isFiltered(c: MatchCriteria): boolean {
  return (
    c.leagueIds.length > 0 || c.regions.length > 0 || c.teamIds.length > 0 || c.tournaments.length > 0 ||
    c.date.preset !== "all" || c.period !== "all" || c.query.trim() !== ""
  );
}
