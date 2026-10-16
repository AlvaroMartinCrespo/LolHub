import { describe, expect, it } from "vitest";
import { MIN_SAMPLE, computeTeamStats, ratio } from "@/lib/stats/formulas";
import { applyStatsFilters, buildStatsOptions, hasStatsFilters, parseStatsFilters } from "@/lib/stats/filters";
import { checkConsistency } from "@/lib/stats/validate";
import { finished, makeMatch } from "./fixtures";

describe("ratio", () => {
  it("V / (V + D) × 100", () => {
    expect(ratio(3, 1)).toBe(75);
    expect(ratio(0, 0)).toBeNull();
    expect(ratio(0, 4)).toBe(0);
  });
});

describe("computeTeamStats", () => {
  const series = [
    finished(1, 1, 2, 0), finished(2, 1, 2, 1), finished(3, 2, 0, 2), finished(4, 2, 1, 2), finished(5, 1, 2, 1),
  ];
  it("series y mapas coinciden con el cálculo manual", () => {
    const s = computeTeamStats(series, 1);
    expect(s.series).toEqual({ wins: 3, losses: 2, winRate: 60 });
    expect(s.maps.wins).toBe(7);
    expect(s.maps.losses).toBe(6);
    expect(s.maps.winRate).toBeCloseTo(53.846, 2);
    expect(s.sample.series).toBe(5);
    expect(s.sample.maps).toBe(13);
  });
  it("el equipo rival ve el resultado inverso", () => {
    const s = computeTeamStats(series, 2);
    expect(s.series).toEqual({ wins: 2, losses: 3, winRate: 40 });
  });
  it("forma: últimas 5, la más reciente primero", () => {
    expect(computeTeamStats(series, 1).form).toEqual(["W", "L", "L", "W", "W"]);
  });
  it("excluye incomparecencias, sin ganador y no finalizados", () => {
    const extra = [
      finished(6, 1, 2, 0, { forfeit: true }),
      finished(7, 1, 1, 1, { winnerTeamId: null }),
      makeMatch({ id: 8, status: "scheduled" }),
    ];
    const s = computeTeamStats([...series, ...extra], 1);
    expect(s.sample.excluded).toEqual({ notFinished: 1, forfeit: 1, noWinner: 1 });
    expect(s.series.wins + s.series.losses).toBe(5);
  });
  it("ignora partidos donde el equipo no juega", () => {
    expect(computeTeamStats(series, 99).sample.series).toBe(0);
  });
  it("muestra pequeña no es fiable; ≥ MIN_SAMPLE sí", () => {
    expect(computeTeamStats(series, 1).reliable).toBe(false);
    const many = Array.from({ length: MIN_SAMPLE }, (_, i) => finished(100 + i, 1, 2, 0));
    expect(computeTeamStats(many, 1).reliable).toBe(true);
  });
  it("detecta formatos mezclados", () => {
    const mixed = [finished(1, 1, 1, 0, { bestOf: 1 }), finished(2, 1, 2, 0, { bestOf: 3 })];
    const s = computeTeamStats(mixed, 1);
    expect(s.mixedFormats).toBe(true);
    expect(s.formats).toEqual({ Bo1: 1, Bo3: 1 });
  });
  it("periodo: fecha más antigua y más reciente de la muestra", () => {
    const s = computeTeamStats(series, 1);
    expect(new Date(s.sample.from!).getDate()).toBe(1);
    expect(new Date(s.sample.to!).getDate()).toBe(5);
  });
});

describe("checkConsistency", () => {
  it("datos coherentes → ok", () => {
    const ms = [finished(1, 1, 2, 0), finished(2, 2, 1, 2)];
    const r = checkConsistency(ms, computeTeamStats(ms, 1));
    expect(r).toMatchObject({ crossChecked: 2, mismatches: 0, totalsOk: true, ok: true });
  });
  it("marcador distinto a los mapas → aviso", () => {
    const bad = finished(1, 1, 2, 0);
    bad.games.pop();
    const r = checkConsistency([bad], computeTeamStats([bad], 1));
    expect(r.mismatches).toBe(1);
    expect(r.ok).toBe(false);
  });
  it("sin mapas no se puede cruzar (no es error)", () => {
    const m = finished(1, 1, 2, 0, { games: [] });
    expect(checkConsistency([m], computeTeamStats([m], 1)).crossChecked).toBe(0);
  });
});

describe("filtros de estadísticas", () => {
  const ms = [
    finished(1, 1, 2, 0, { bestOf: 3, tournamentName: "A", serieName: "S1" }),
    finished(2, 1, 1, 0, { bestOf: 1, tournamentName: "B", serieName: "S2" }),
  ];
  it("parseStatsFilters sanea entradas", () => {
    expect(parseStatsFilters({ period: "xx", bestOf: "abc", tournament: ["A", "B"] })).toEqual({
      period: "all", tournament: "A", season: "", bestOf: "",
    });
    expect(parseStatsFilters({ period: "30d", bestOf: "3" })).toMatchObject({ period: "30d", bestOf: "3" });
  });
  it("aplica torneo, temporada y formato", () => {
    const base = parseStatsFilters({});
    expect(applyStatsFilters(ms, { ...base, tournament: "A" })).toHaveLength(1);
    expect(applyStatsFilters(ms, { ...base, season: "S2" })).toHaveLength(1);
    expect(applyStatsFilters(ms, { ...base, bestOf: "1" })).toHaveLength(1);
    expect(applyStatsFilters(ms, base)).toHaveLength(2);
  });
  it("opciones y hasStatsFilters", () => {
    expect(buildStatsOptions(ms)).toEqual({ tournaments: ["A", "B"], seasons: ["S1", "S2"], formats: ["1", "3"] });
    expect(hasStatsFilters(parseStatsFilters({}))).toBe(false);
    expect(hasStatsFilters(parseStatsFilters({ bestOf: "3" }))).toBe(true);
  });
});
