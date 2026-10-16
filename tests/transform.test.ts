import { describe, expect, it } from "vitest";
import { psMatchSchema } from "@/lib/schemas/pandascore";
import { clean, joinName, toIso } from "@/lib/transform/common";
import { normalizeMatch, normalizeMatchStatus } from "@/lib/transform/match";
import { rawMatch } from "./fixtures";

const norm = (raw: unknown) => normalizeMatch(psMatchSchema.parse(raw));

describe("utilidades", () => {
  it("toIso normaliza y rechaza fechas inválidas", () => {
    expect(toIso("2026-10-01T10:00:00+02:00")).toBe("2026-10-01T08:00:00.000Z");
    expect(toIso("no es fecha")).toBeNull();
    expect(toIso(null)).toBeNull();
  });
  it("clean y joinName", () => {
    expect(clean("  hola ")).toBe("hola");
    expect(clean("   ")).toBeNull();
    expect(joinName("Ada", " Lovelace ")).toBe("Ada Lovelace");
    expect(joinName(null, null)).toBeNull();
  });
});

describe("estados", () => {
  it.each([
    ["not_started", "scheduled"], ["running", "live"], ["finished", "finished"],
    ["postponed", "postponed"], ["canceled", "canceled"], ["otro", "unknown"], [null, "unknown"],
  ] as const)("%s → %s", (input, expected) => expect(normalizeMatchStatus(input)).toBe(expected));
});

describe("normalizeMatch", () => {
  it("usa begin_at y si no scheduled_at", () => {
    expect(norm(rawMatch(1)).startTime).toBe("2026-10-20T18:00:00.000Z");
    expect(norm(rawMatch(1, { begin_at: "2026-10-20T19:00:00Z" })).startTime).toBe("2026-10-20T19:00:00.000Z");
  });
  it("empareja marcador por team_id (no por posición)", () => {
    const m = norm(rawMatch(1, { status: "finished", winner_id: 2, results: [{ team_id: 2, score: 2 }, { team_id: 1, score: 1 }] }));
    expect(m.sides?.map((s) => s.score)).toEqual([1, 2]);
    expect(m.winnerTeamId).toBe(2);
  });
  it("ordena los mapas por posición y distingue ganador de cada mapa", () => {
    const m = norm(rawMatch(1, { games: [
      { id: 12, position: 2, status: "finished", winner: { id: 2, type: "Team" }, length: 1900 },
      { id: 11, position: 1, status: "finished", winner: { id: 1, type: "Team" }, length: 1700 },
    ] }));
    expect(m.games.map((g) => g.position)).toEqual([1, 2]);
    expect(m.games.map((g) => g.winnerTeamId)).toEqual([1, 2]);
    expect(m.games[0].durationSeconds).toBe(1700);
  });
  it("menos de 2 rivales → sides null (por determinar)", () => {
    expect(norm(rawMatch(1, { opponents: [] })).sides).toBeNull();
  });
  it("sin marcador → score null", () => {
    expect(norm(rawMatch(1, { results: [] })).sides?.[0].score).toBeNull();
  });
  it("nombre de equipo vacío → siglas o «Por determinar»", () => {
    const m = norm(rawMatch(1, { opponents: [
      { type: "Team", opponent: { id: 1, name: null, acronym: "ALP" } },
      { type: "Team", opponent: { id: 2, name: null, acronym: null } },
    ] }));
    expect(m.sides?.map((s) => s.team.name)).toEqual(["ALP", "Por determinar"]);
  });
  it("conserva ids de liga y torneo", () => {
    const m = norm(rawMatch(1));
    expect(m.league?.id).toBe(1);
    expect(m.tournamentId).toBe(10);
  });
  it("campos ausentes no rompen el esquema", () => {
    expect(() => norm({ id: 9 })).not.toThrow();
    expect(() => psMatchSchema.parse({ name: "sin id" })).toThrow();
  });
});
