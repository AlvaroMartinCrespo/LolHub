import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NOT_RECOMMENDED, SOURCES, SOURCE_IDS, getSource, isSourceId, quotaLimitedSources,
} from "@/lib/sources/catalog";
import { DATA_KINDS, RESPONSIBILITIES, ROUTES, canQuery, kindsOf, routeFor, sourceFor } from "@/lib/sources/routing";
import { getSupabaseConfig } from "@/lib/config/env";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0001_data_sources.sql"), "utf8");

describe("catálogo de fuentes (12.1)", () => {
  it("tiene una entrada por id, sin duplicados", () => {
    expect(SOURCES.map((s) => s.id).sort()).toEqual([...SOURCE_IDS].sort());
  });
  it("PandaScore es la única fuente principal", () => {
    expect(SOURCES.filter((s) => s.role === "principal").map((s) => s.id)).toEqual(["pandascore"]);
  });
  it("cuotas conocidas: PandaScore 1000/h, CitoAPI 500/mes", () => {
    expect(getSource("pandascore").quota).toEqual({ calls: 1000, per: "hour" });
    expect(getSource("citoapi").quota).toEqual({ calls: 500, per: "month" });
    expect(quotaLimitedSources().map((s) => s.id)).toEqual(["pandascore", "citoapi"]);
  });
  it("Leaguepedia es CC-BY-SA y todas las fuentes exigen atribución", () => {
    expect(getSource("leaguepedia").license).toBe("CC-BY-SA.");
    expect(SOURCES.every((s) => s.attributionRequired)).toBe(true);
  });
  it("cada responsabilidad apunta a una fuente existente y se cubren las 6 áreas", () => {
    expect(RESPONSIBILITIES).toHaveLength(6);
    for (const r of RESPONSIBILITIES) expect(isSourceId(r.source)).toBe(true);
  });
  it("lolesports queda documentada como no recomendada", () => {
    expect(NOT_RECOMMENDED.name).toMatch(/lolesports/i);
    expect(SOURCES.some((s) => /lolesports/i.test(s.name))).toBe(false);
  });
  it("getSource rechaza ids desconocidos", () => {
    expect(() => getSource("x" as never)).toThrow();
    expect(isSourceId("x")).toBe(false);
  });
});

describe("esquema Supabase (12.1)", () => {
  it("la semilla SQL coincide con el catálogo", () => {
    for (const s of SOURCES) {
      const name = s.name.replace(/'/g, "''");
      const row = sql.split("\n").find((l) => l.includes(`('${s.id}',`));
      expect(row, s.id).toBeDefined();
      expect(row!, s.id).toContain(`'${name}'`);
      expect(row!, s.id).toContain(`'${s.access}'`);
      expect(row!, s.id).toContain(`'${s.role}'`);
      expect(row!, s.id).toContain(`'${s.license.replace(/'/g, "''")}'`);
      if (s.quota) expect(row!, s.id).toContain(`${s.quota.calls}, '${s.quota.per}'`);
      else expect(row!, s.id).toContain("null, null");
    }
  });
  it("activa RLS sin crear políticas y cierra la función a roles públicos", () => {
    expect(sql).toMatch(/alter table public\.data_sources\s+enable row level security/);
    expect(sql).toMatch(/alter table public\.source_quota_usage\s+enable row level security/);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).toMatch(/revoke all on function public\.bump_source_quota[^;]*from public, anon, authenticated/);
  });
});

describe("configuración de Supabase", () => {
  const keep = { ...process.env };
  const restore = () => { process.env = { ...keep }; };
  it("devuelve null si falta alguna variable", () => {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(getSupabaseConfig()).toBeNull();
    process.env.SUPABASE_URL = "https://x.supabase.co";
    expect(getSupabaseConfig()).toBeNull();
    restore();
  });
  it("normaliza la URL y exige https", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    process.env.SUPABASE_URL = "https://x.supabase.co//";
    expect(getSupabaseConfig()).toEqual({ url: "https://x.supabase.co", serviceRoleKey: "k" });
    process.env.SUPABASE_URL = "http://x.supabase.co";
    expect(() => getSupabaseConfig()).toThrow(/https/);
    restore();
  });
});

describe("reparto de responsabilidades (12.2)", () => {
  it("cada tipo de dato tiene exactamente una ruta", () => {
    const all = ROUTES.flatMap((r) => r.kinds);
    expect([...all].sort()).toEqual([...DATA_KINDS].sort());
    expect(new Set(all).size).toBe(all.length);
  });
  it("asigna cada dato a la fuente del plan", () => {
    for (const k of ["schedule", "results", "teams", "players", "tournaments"] as const) expect(sourceFor(k)).toBe("pandascore");
    expect(sourceFor("matchStats")).toBe("oracleselixir");
    for (const k of ["rosters", "teamHistory", "teamLogos"] as const) expect(sourceFor(k)).toBe("leaguepedia");
    expect(sourceFor("championAssets")).toBe("datadragon");
    expect(sourceFor("gapFill")).toBe("citoapi");
    expect(sourceFor("soloQueue")).toBe("riotapi");
  });
  it("la tabla pública tiene 6 filas con fuentes válidas", () => {
    expect(RESPONSIBILITIES).toHaveLength(6);
    for (const r of RESPONSIBILITIES) expect(isSourceId(r.source)).toBe(true);
  });
  it("CitoAPI, Leaguepedia y Oracle's Elixir nunca se consultan por visita", () => {
    for (const k of ["gapFill", "rosters", "teamHistory", "teamLogos", "matchStats"] as const) {
      expect(canQuery(k, { perVisit: true }).ok, k).toBe(false);
      expect(canQuery(k, { perVisit: false }).ok, k).toBe(true);
    }
    expect(canQuery("schedule", { perVisit: true }).ok).toBe(true);
  });
  it("la integración futura de Riot no se consulta", () => {
    const r = canQuery("soloQueue", { perVisit: false });
    expect(r.ok).toBe(false);
  });
  it("Leaguepedia exige caché larga (≥ 1 día) y Oracle's Elixir es importación", () => {
    expect(routeFor("rosters").minCacheSeconds).toBeGreaterThanOrEqual(86_400);
    expect(routeFor("matchStats").mode).toBe("imported");
  });
  it("las fuentes con cuota baja o límites agresivos nunca admiten llamadas por visita", () => {
    for (const r of ROUTES) if (["citoapi", "leaguepedia"].includes(r.source)) expect(r.perVisitCalls).toBe(false);
    expect(kindsOf("pandascore")).toHaveLength(5);
  });
});
