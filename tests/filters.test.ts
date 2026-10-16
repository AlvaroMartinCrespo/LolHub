import { describe, expect, it } from "vitest";
import {
  buildOptions, filterMatches, isFiltered, matchesDate, matchesPeriod, normalizeText, sortRecent, sortUpcoming,
} from "@/lib/filters/matches";
import { EMPTY_CRITERIA } from "@/lib/filters/types";
import { makeMatch, team } from "./fixtures";

const now = new Date(2026, 9, 14, 12, 0, 0); // 14-oct-2026 12:00 local
const at = (dayOffset: number, hour = 10) => new Date(2026, 9, 14 + dayOffset, hour).toISOString();
const crit = (o: Partial<typeof EMPTY_CRITERIA>) => ({ ...EMPTY_CRITERIA, ...o });
const ids = (l: { id: number }[]) => l.map((m) => m.id);

const matches = [
  makeMatch({ id: 1, startTime: at(0, 18) }),
  makeMatch({ id: 2, startTime: at(2), league: { id: 2, name: "Liga Dos", slug: null, imageUrl: null }, sides: [
    { team: team(3, "T1", "KR"), score: null }, { team: team(4, "Gen.G", "KR"), score: null }] }),
  makeMatch({ id: 3, startTime: at(10), tournamentName: "Grupos", sides: [
    { team: team(1, "Alpha", "ES"), score: null }, { team: team(5, "Kárminé", "FR"), score: null }] }),
  makeMatch({ id: 4, startTime: null }),
  makeMatch({ id: 5, status: "live", startTime: at(-1) }),
];

describe("normalizeText", () => {
  it("quita tildes, mayúsculas y espacios", () => {
    expect(normalizeText("  KÁRMINÉ ")).toBe("karmine");
  });
});

describe("matchesDate (zona horaria local)", () => {
  it("todas: acepta incluso sin fecha", () => {
    expect(matchesDate(null, { preset: "all", date: null }, now)).toBe(true);
  });
  it("hoy: solo el día local actual", () => {
    const f = { preset: "today" as const, date: null };
    expect(matchesDate(at(0, 23), f, now)).toBe(true);
    expect(matchesDate(at(1, 0), f, now)).toBe(false);
    expect(matchesDate(at(-1, 23), f, now)).toBe(false);
  });
  it("próximos 7 días: hoy hasta +6 incluido", () => {
    const f = { preset: "next7" as const, date: null };
    expect(matchesDate(at(6, 20), f, now)).toBe(true);
    expect(matchesDate(at(7, 1), f, now)).toBe(false);
  });
  it("día concreto", () => {
    const f = { preset: "date" as const, date: "2026-10-16" };
    expect(matchesDate(at(2), f, now)).toBe(true);
    expect(matchesDate(at(3), f, now)).toBe(false);
  });
  it("sin fecha no pasa un filtro de fecha", () => {
    expect(matchesDate(null, { preset: "today", date: null }, now)).toBe(false);
  });
});

describe("matchesPeriod", () => {
  it("filtra por antigüedad", () => {
    expect(matchesPeriod(at(-3), "7d", now)).toBe(true);
    expect(matchesPeriod(at(-8), "7d", now)).toBe(false);
    expect(matchesPeriod(at(-8), "30d", now)).toBe(true);
    expect(matchesPeriod(null, "7d", now)).toBe(false);
    expect(matchesPeriod(null, "all", now)).toBe(true);
  });
});

describe("filterMatches", () => {
  it("sin criterios devuelve todo", () => expect(filterMatches(matches, EMPTY_CRITERIA, now)).toHaveLength(5));
  it("liga (multiselección)", () => {
    expect(ids(filterMatches(matches, crit({ leagueIds: ["2"] }), now))).toEqual([2]);
    expect(ids(filterMatches(matches, crit({ leagueIds: ["1", "2"] }), now))).toEqual([1, 2, 3, 4, 5]);
  });
  it("región", () => expect(ids(filterMatches(matches, crit({ regions: ["FR"] }), now))).toEqual([3]));
  it("equipo y torneo", () => {
    expect(ids(filterMatches(matches, crit({ teamIds: ["5"] }), now))).toEqual([3]);
    expect(ids(filterMatches(matches, crit({ tournaments: ["Grupos"] }), now))).toEqual([3]);
  });
  it("búsqueda sin tildes", () => expect(ids(filterMatches(matches, crit({ query: "karmine" }), now))).toEqual([3]));
  it("combina filtros con AND", () => {
    expect(filterMatches(matches, crit({ leagueIds: ["2"], regions: ["ES"] }), now)).toHaveLength(0);
  });
});

describe("orden y opciones", () => {
  it("próximos: directos primero, cronológico, sin fecha al final", () => {
    expect(ids(sortUpcoming(matches))).toEqual([5, 1, 2, 3, 4]);
  });
  it("resultados: más reciente primero", () => {
    const r = [makeMatch({ id: 1, endTime: at(-3) }), makeMatch({ id: 2, endTime: at(-1) })];
    expect(ids(sortRecent(r))).toEqual([2, 1]);
  });
  it("opciones únicas y ordenadas", () => {
    const o = buildOptions(matches);
    expect(o.regions.map((r) => r.value)).toEqual(["ES", "FR", "KR"]);
    expect(o.leagues).toHaveLength(2);
  });
  it("isFiltered detecta criterios activos", () => {
    expect(isFiltered(EMPTY_CRITERIA)).toBe(false);
    expect(isFiltered(crit({ query: " x " }))).toBe(true);
    expect(isFiltered(crit({ query: "   " }))).toBe(false);
  });
});
