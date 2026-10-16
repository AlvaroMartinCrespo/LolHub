// Paso 12.3.1 — adaptadores, auditoría y equivalencias. Datos SINTÉTICOS con la forma documentada de cada fuente.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DataSourceError } from "@/lib/services/errors";
import { kindsOf } from "@/lib/sources/routing";
import { SOURCE_IDS } from "@/lib/sources/catalog";
import { getAdapters } from "@/lib/sources/adapters";
import { CITOAPI_CALL_LIMIT, consumeCitoApiQuota } from "@/lib/sources/citoapi-quota";
import { guardQuery, normalizeKey, getJson } from "@/lib/sources/adapters/base";
import {
  createCitoApiAdapter, normalizeMatchGames, normalizePlayerTeams, stintIdentities, CITOAPI_DOCUMENTED_ENDPOINTS,
} from "@/lib/sources/adapters/citoapi";
import {
  ANON_ROW_LIMIT, LEAGUEPEDIA_FIELDS, assertNoApiError, cargoDateToIso, cargoString, createLeaguepediaAdapter,
  leaguepediaFileUrl, normalizeTeams, normalizeTenures, teamIdentity as lpTeamIdentity,
} from "@/lib/sources/adapters/leaguepedia";
import { gameIdentities, iterateCsv, parseOraclesElixirCsv } from "@/lib/sources/adapters/oracleselixir";
import { leagueIdentity, playerIdentity, teamIdentity as psTeamIdentity, tournamentIdentity } from "@/lib/sources/adapters/pandascore";
import {
  confirmEquivalence, loadEquivalences, rejectEquivalence, resolveCanonical, resolveExternal, suggestEquivalences,
  toProposedEntry, validateEquivalences, type Equivalence,
} from "@/lib/sources/equivalences";
import type { EntityIdentity, EntityRef, SourceMeta } from "@/types/sources";
import * as audit from "../scripts/lib/audit-helpers.mjs";

const meta: SourceMeta = { source: "citoapi", fetchedAt: "2026-10-16T10:00:00.000Z" };
const NOW = () => new Date("2026-10-16T10:00:00.000Z");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// ── Contrato común ─────────────────────────────────────────
describe("contrato de adaptadores", () => {
  it("cada adaptador sirve exactamente los tipos de dato que le asigna el reparto de 12.2", () => {
    const adapters = getAdapters();
    for (const [id, a] of Object.entries(adapters)) {
      expect(a.id).toBe(id);
      expect([...a.kinds].sort()).toEqual(kindsOf(a.id).sort());
    }
  });
  it("hay un adaptador por cada fuente implementable (PandaScore, CitoAPI, Leaguepedia, Oracle's Elixir)", () => {
    expect(Object.keys(getAdapters()).sort()).toEqual(["citoapi", "leaguepedia", "oracleselixir", "pandascore"]);
    expect(SOURCE_IDS).toContain("datadragon"); // sin adaptador a propósito: CDN estático
  });
  it("guardQuery aplica la política de 12.2", () => {
    expect(() => guardQuery("schedule", { perVisit: true })).not.toThrow();
    expect(() => guardQuery("gapFill", { perVisit: true })).toThrowError(DataSourceError);
    expect(() => guardQuery("soloQueue", { perVisit: false })).toThrowError(/no está integrada/);
    try { guardQuery("rosters", { perVisit: true }); } catch (e) { expect((e as DataSourceError).kind).toBe("blocked"); }
  });
  it("normalizeKey ignora tildes, mayúsculas y signos", () => {
    expect(normalizeKey("  Fnatic™ Ünited! ")).toBe("fnatic™ünited".normalize("NFD").replace(/\p{M}+/gu, "").replace(/[^\p{L}\p{N}]+/gu, ""));
    expect(normalizeKey("T1")).toBe("t1");
    expect(normalizeKey(null)).toBe("");
  });
});

describe("getJson", () => {
  const url = new URL("https://example.test/x");
  it("reintenta en 5xx y devuelve la respuesta buena", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ ok: 1 }));
    const r = await getJson({ url, fetchImpl: f, sleep: async () => {} });
    expect(r.body).toEqual({ ok: 1 });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("no reintenta 401/404 y tipa el error", async () => {
    const f = vi.fn().mockResolvedValue(json({}, 401));
    await expect(getJson({ url, fetchImpl: f, sleep: async () => {} })).rejects.toMatchObject({ kind: "unauthorized" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("retries: 0 no reintenta ni siquiera en 429", async () => {
    const f = vi.fn().mockResolvedValue(json({}, 429));
    await expect(getJson({ url, fetchImpl: f, retries: 0 })).rejects.toMatchObject({ kind: "rate_limited" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("cuerpo no JSON → invalid", async () => {
    const f = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(getJson({ url, fetchImpl: f, retries: 0 })).rejects.toMatchObject({ kind: "invalid" });
  });
});

// ── PandaScore ─────────────────────────────────────────────
describe("identidades de PandaScore", () => {
  it("usan el ID numérico como cadena y no inventan región", () => {
    const t = psTeamIdentity({ id: 126061, name: "Alpha", acronym: "ALP", imageUrl: null, location: "ES" });
    expect(t).toMatchObject({ source: "pandascore", kind: "team", externalId: "126061", acronym: "ALP", region: "ES" });
    expect(psTeamIdentity({ id: 1, name: "B", acronym: null, imageUrl: null, region: null, roster: [] }).region).toBeNull();
    expect(playerIdentity({ id: 7, name: "Z", fullName: null, role: null, nationality: "KR", imageUrl: null, active: null, team: null }).region).toBe("KR");
    expect(tournamentIdentity({ id: 3, name: "Playoffs", startsAt: null, endsAt: null, leagueId: null, serieId: null, tier: null }).kind).toBe("tournament");
    expect(leagueIdentity({ id: 4, name: "Liga", slug: "liga", imageUrl: null }).acronym).toBe("liga");
  });
  it("las consultas por visita están permitidas para PandaScore (principal)", () => {
    expect(() => guardQuery("results", { perVisit: true })).not.toThrow();
  });
});

// ── CitoAPI ────────────────────────────────────────────────
const citoGames = {
  success: true,
  data: {
    matchId: "115548128963037541", bestOf: 3, score: { team1: 2, team2: 1 },
    games: [
      { gameId: "g1", winner: "team1" }, { gameId: "g2", winner: "team2" }, { gameId: "g3", winner: "team1" }, { gameId: "g4", winner: null },
    ],
  },
};
const citoTeams = {
  success: true,
  data: {
    playerId: "c76dc4df", playerName: "Jugador Uno",
    teams: [
      { teamSlug: "alpha", teamName: "Alpha", role: "MID", startedAt: "2026-02-01T00:00:00.000Z", endedAt: null },
      { teamSlug: "beta", teamName: null, role: "", startedAt: "2025-01-01T00:00:00.000Z", endedAt: "2025-12-31T00:00:00.000Z" },
      { teamSlug: "gamma", teamName: "Gamma", role: "TOP", startedAt: "no-es-fecha" },
    ],
  },
};

describe("adaptador CitoAPI", () => {
  it("normaliza la serie documentada a ExternalSeries", () => {
    const s = normalizeMatchGames(citoGames, meta);
    expect(s).toMatchObject({ externalId: "115548128963037541", bestOf: 3, scoreTeam1: 2, scoreTeam2: 1 });
    expect(s.games.map((g) => g.winnerSide)).toEqual([1, 2, 1, null]);
    expect(s.meta.source).toBe("citoapi");
  });
  it("normaliza el historial de equipos: fechas ISO, «sigue» solo si endedAt es null, sin inventar", () => {
    const st = normalizePlayerTeams(citoTeams, meta);
    expect(st).toHaveLength(3);
    expect(st[0]).toMatchObject({ teamExternalId: "alpha", playerExternalId: "c76dc4df", current: true, endedAt: null, role: "MID" });
    expect(st[1]).toMatchObject({ teamName: "beta", role: null, current: false, endedAt: "2025-12-31T00:00:00.000Z" });
    expect(st[2]).toMatchObject({ startedAt: null, current: null });
  });
  it("rechaza respuestas que no cumplen el esquema documentado", () => {
    expect(() => normalizeMatchGames({ success: false }, meta)).toThrowError(/esquema/);
    expect(() => normalizeMatchGames({ success: true, data: { bestOf: 3 } }, meta)).toThrowError(DataSourceError);
    expect(() => normalizePlayerTeams({ data: {} }, meta)).toThrowError(DataSourceError);
  });
  it("identidades: equipo por slug, jugador por UUID, sin duplicados", () => {
    const ids = stintIdentities([...normalizePlayerTeams(citoTeams, meta), ...normalizePlayerTeams(citoTeams, meta)]);
    expect(ids.filter((i) => i.kind === "player")).toHaveLength(1);
    expect(ids.map((i) => i.externalId).sort()).toEqual(["alpha", "beta", "c76dc4df", "gamma"]);
  });
  it("envía la clave en cabecera, sin reintentos, y bloquea llamadas por visita", async () => {
    const f = vi.fn().mockResolvedValue(json(citoGames));
    const acquireQuota = vi.fn().mockResolvedValue(undefined);
    const a = createCitoApiAdapter({ fetchImpl: f, apiKey: "secreto-123", now: NOW, acquireQuota });
    const s = await a.matchGames("115548128963037541", { perVisit: false });
    expect(s.meta).toEqual({ source: "citoapi", fetchedAt: "2026-10-16T10:00:00.000Z" });
    const [calledUrl, init] = f.mock.calls[0];
    expect(String(calledUrl)).toBe("https://api.citoapi.com/api/v1/lol/matches/115548128963037541/games");
    expect((init as RequestInit).headers).toMatchObject({ "x-api-key": "secreto-123" });
    expect(String(calledUrl)).not.toContain("secreto");
    await expect(a.matchGames("1", { perVisit: true })).rejects.toMatchObject({ kind: "blocked" });
    expect(f).toHaveBeenCalledTimes(1);
    expect(acquireQuota).toHaveBeenCalledTimes(1);
  });
  it("no reintenta en 5xx (cada intento gasta cuota)", async () => {
    const f = vi.fn().mockResolvedValue(json({}, 503));
    const a = createCitoApiAdapter({ fetchImpl: f, apiKey: "k", acquireQuota: async () => {} });
    await expect(a.playerTeams("abc", { perVisit: false })).rejects.toMatchObject({ kind: "server" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("no llama al proveedor cuando la cuota llega al margen de seguridad", async () => {
    const f = vi.fn();
    const a = createCitoApiAdapter({
      fetchImpl: f,
      apiKey: "k",
      acquireQuota: async () => { throw new DataSourceError("rate_limited", "Cuota agotada"); },
    });
    await expect(a.matchGames("1", { perVisit: false })).rejects.toMatchObject({ kind: "rate_limited" });
    expect(f).not.toHaveBeenCalled();
  });
  it("rechaza IDs con caracteres peligrosos antes de llamar", async () => {
    const f = vi.fn();
    const a = createCitoApiAdapter({ fetchImpl: f, apiKey: "k" });
    await expect(a.matchGames("../../x?y=1", { perVisit: false })).rejects.toMatchObject({ kind: "invalid" });
    expect(f).not.toHaveBeenCalled();
  });
  it("sin clave → error de configuración tipado", async () => {
    const keep = process.env.CITOAPI_KEY;
    delete process.env.CITOAPI_KEY;
    try {
      await expect(createCitoApiAdapter({ fetchImpl: vi.fn() }).matchGames("1", { perVisit: false })).rejects.toMatchObject({ kind: "config" });
    } finally { if (keep) process.env.CITOAPI_KEY = keep; }
  });
  it("solo declara como documentados los endpoints con ejemplo de respuesta", () => {
    expect([...CITOAPI_DOCUMENTED_ENDPOINTS]).toEqual(["/lol/matches/{id}/games", "/lol/players/{id}/teams"]);
  });
});

describe("contador de cuota CitoAPI", () => {
  const config = { url: "https://db.example", serviceRoleKey: "server-secret" };

  it("reserva de forma atómica y deja margen respecto a las 500 llamadas", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(12));
    const calls = await consumeCitoApiQuota(config, new Date("2026-10-16T12:00:00Z"), fetchImpl);
    const [requestUrl, init] = fetchImpl.mock.calls[0];

    expect(calls).toBe(12);
    expect(CITOAPI_CALL_LIMIT).toBe(475);
    expect(String(requestUrl)).toBe("https://db.example/rest/v1/rpc/try_bump_source_quota");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      p_source: "citoapi", p_period: "2026-10-01", p_by: 1, p_limit: 475,
    });
  });

  it("bloquea cuando la reserva atómica devuelve null", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(null));
    await expect(consumeCitoApiQuota(config, NOW(), fetchImpl)).rejects.toMatchObject({ kind: "rate_limited" });
  });
});

// ── Leaguepedia ────────────────────────────────────────────
const lpMeta: SourceMeta = { source: "leaguepedia", fetchedAt: "2026-10-16T10:00:00.000Z" };
const lpTeams = {
  cargoquery: [
    { title: { Name: "Equipo Uno", OverviewPage: "Equipo Uno", Short: "EU1", Location: "Spain", Region: "Europe", Image: "Equipo Unologo square.png", IsDisbanded: "0" } },
    { title: { Name: "Sin Datos", OverviewPage: "", Short: "", Location: "", Region: "", Image: "", IsDisbanded: "" } },
  ],
};
const lpTenures = {
  cargoquery: [
    { title: { Player: "Jugador A", Team: "Equipo Uno", IsCurrent: "1", DateJoin: "2026-01-05", DateLeave: "", Role: "Mid" } },
    { title: { Player: "Jugador B", Team: "Equipo Uno", IsCurrent: "0", DateJoin: "2025-01-05 12:30:00", DateLeave: "2025-06-30", Role: "" } },
  ],
};

describe("adaptador Leaguepedia", () => {
  it("normaliza equipos: vacíos → null, logo como archivo (no URL), id = OverviewPage", () => {
    const t = normalizeTeams(lpTeams, lpMeta);
    expect(t[0]).toMatchObject({ externalId: "Equipo Uno", acronym: "EU1", region: "Europe", disbanded: false, logoFile: "Equipo Unologo square.png" });
    expect(t[1]).toMatchObject({ externalId: "Sin Datos", acronym: null, region: null, disbanded: null, logoFile: null });
    expect(JSON.stringify(t)).not.toContain("http");
  });
  it("normaliza tenencias con fechas UTC válidas", () => {
    const s = normalizeTenures(lpTenures, lpMeta);
    expect(s[0]).toMatchObject({ playerName: "Jugador A", current: true, startedAt: "2026-01-05T00:00:00.000Z", endedAt: null, role: "Mid" });
    expect(s[1]).toMatchObject({ current: false, startedAt: "2025-01-05T12:30:00.000Z", endedAt: "2025-06-30T00:00:00.000Z", role: null });
  });
  it("cargoDateToIso descarta lo que no es una fecha real", () => {
    expect(cargoDateToIso("2026-02-30")).toBeNull();
    expect(cargoDateToIso("ayer")).toBeNull();
    expect(cargoDateToIso("")).toBeNull();
    expect(cargoDateToIso(undefined)).toBeNull();
  });
  it("detecta el límite de uso dentro de un HTTP 200", () => {
    const body = { error: { code: "ratelimited", info: "You've exceeded your rate limit." } };
    expect(() => assertNoApiError(body)).toThrowError(/ratelimited/);
    try { normalizeTeams(body, lpMeta); } catch (e) { expect((e as DataSourceError).kind).toBe("rate_limited"); }
    try { normalizeTenures({ error: { code: "otro" } }, lpMeta); } catch (e) { expect((e as DataSourceError).kind).toBe("invalid"); }
    expect(() => assertNoApiError({ cargoquery: [] })).not.toThrow();
  });
  it("rechaza formatos inesperados", () => {
    expect(() => normalizeTeams({ cargoquery: [{ title: {} }] }, lpMeta)).toThrowError(DataSourceError);
    expect(() => normalizeTenures("x", lpMeta)).toThrowError(DataSourceError);
  });
  it("cargoString rechaza comillas, barras y caracteres de control", () => {
    expect(cargoString("Anyone's Legend")).toBe(`"Anyone's Legend"`);
    for (const bad of ['a"b', "a\\b", "a\nb", "", "   ", "x".repeat(121)]) expect(() => cargoString(bad)).toThrowError(DataSourceError);
  });
  it("construye la consulta Cargo correcta y sin reintentos", async () => {
    const f = vi.fn().mockResolvedValue(json(lpTeams));
    const a = createLeaguepediaAdapter({ fetchImpl: f, now: NOW, limit: 9999 });
    const teams = await a.teamsByRegion("Europe", { perVisit: false });
    expect(teams).toHaveLength(2);
    const u = new URL(String(f.mock.calls[0][0]));
    expect(u.origin + u.pathname).toBe("https://lol.fandom.com/api.php");
    expect(u.searchParams.get("action")).toBe("cargoquery");
    expect(u.searchParams.get("tables")).toBe("Teams");
    expect(u.searchParams.get("where")).toBe('Region="Europe"');
    expect(u.searchParams.get("limit")).toBe(String(ANON_ROW_LIMIT));
    expect(u.searchParams.get("maxlag")).toBe("5");
    expect(u.searchParams.get("fields")!.split(",").sort()).toEqual([...LEAGUEPEDIA_FIELDS.Teams.verified].sort());
    expect((f.mock.calls[0][1] as RequestInit & { next?: { revalidate: number } }).next).toEqual({ revalidate: 86_400 });
  });
  it("tenencias: pide también los campos pendientes de verificar y los marca como tales", async () => {
    const f = vi.fn().mockResolvedValue(json(lpTenures));
    await createLeaguepediaAdapter({ fetchImpl: f }).teamTenures("Equipo Uno", { perVisit: false });
    const fields = new URL(String(f.mock.calls[0][0])).searchParams.get("fields")!.split(",");
    expect(fields).toEqual([...LEAGUEPEDIA_FIELDS.Tenures.verified, ...LEAGUEPEDIA_FIELDS.Tenures.unverified]);
    expect(LEAGUEPEDIA_FIELDS.Tenures.unverified.length).toBeGreaterThan(0);
  });
  it("un rate limit dentro de un 200 llega como rate_limited y no se reintenta", async () => {
    const f = vi.fn().mockResolvedValue(json({ error: { code: "ratelimited", info: "x" } }));
    await expect(createLeaguepediaAdapter({ fetchImpl: f }).teamsByName("X", { perVisit: false })).rejects.toMatchObject({ kind: "rate_limited" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("prohíbe consultar por visita", async () => {
    const f = vi.fn();
    await expect(createLeaguepediaAdapter({ fetchImpl: f }).teamsByName("X", { perVisit: true })).rejects.toMatchObject({ kind: "blocked" });
    expect(f).not.toHaveBeenCalled();
  });
  it("la URL del archivo de logo es explícita y está separada del modelo", () => {
    expect(leaguepediaFileUrl("Equipo Unologo square.png")).toBe("https://lol.fandom.com/wiki/Special:FilePath/Equipo_Unologo_square.png");
    expect(lpTeamIdentity(normalizeTeams(lpTeams, lpMeta)[0])).toMatchObject({ source: "leaguepedia", kind: "team", acronym: "EU1" });
  });
  it("el script de auditoría pide exactamente los campos que usa el adaptador", () => {
    const script = readFileSync(join(process.cwd(), "scripts/audit-sources.mjs"), "utf8");
    for (const [table, fields] of Object.entries({
      Teams: LEAGUEPEDIA_FIELDS.Teams.verified,
      Tenures: [...LEAGUEPEDIA_FIELDS.Tenures.verified, ...LEAGUEPEDIA_FIELDS.Tenures.unverified],
    })) {
      const m = new RegExp(`${table}:\\s*\\[([^\\]]*)\\]`).exec(script);
      expect(m, table).not.toBeNull();
      const inScript = [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
      expect(inScript, table).toEqual([...fields].sort());
    }
  });
});

// ── Oracle's Elixir ────────────────────────────────────────
const HEAD = "gameid,datacomplete,league,year,split,playoffs,date,game,patch,participantid,side,position,playername,playerid,teamname,teamid,champion,gamelength,result,kills,deaths,assists,totalgold,damagetochampions,minionkills,monsterkills,wardsplaced";
function game(id: string, opts: { length?: number; blueWins?: boolean; players?: number; complete?: string } = {}): string[] {
  const length = opts.length ?? 1800;
  const blueWins = opts.blueWins ?? true;
  const n = opts.players ?? 10;
  const rows: string[] = [];
  for (let p = 1; p <= n; p++) {
    const blue = p <= 5;
    const res = blue === blueWins ? 1 : 0;
    rows.push(`${id},${opts.complete ?? "1"},LEC,2026,Spring,0,2026-03-01 18:05:10,1,15.5,${p},${blue ? "Blue" : "Red"},mid,"Jug, ${p}",pl${p},${blue ? "Alpha" : "Beta"},${blue ? "t-a" : "t-b"},Ahri,${length},${res},${p},2,3,10000,20000.5,200,10,12`);
  }
  rows.push(`${id},${opts.complete ?? "1"},LEC,2026,Spring,0,2026-03-01 18:05:10,1,15.5,100,Blue,team,,,Alpha,t-a,,${length},${blueWins ? 1 : 0},20,5,30,,,,,`);
  rows.push(`${id},${opts.complete ?? "1"},LEC,2026,Spring,0,2026-03-01 18:05:10,1,15.5,200,Red,team,,,Beta,t-b,,${length},${blueWins ? 0 : 1},5,20,10,,,,,`);
  return rows;
}
const csv = (...games: string[][]) => [HEAD, ...games.flat()].join("\r\n") + "\r\n";

describe("lector de CSV", () => {
  it("maneja comillas, comas, comillas escapadas, saltos de línea internos, BOM y CRLF/LF", () => {
    const text = '\uFEFFa,b,c\r\n1,"x,y","he said ""hi"""\n"l1\nl2",,3';
    expect([...iterateCsv(text)]).toEqual([["a", "b", "c"], ["1", "x,y", 'he said "hi"'], ["l1\nl2", "", "3"]]);
    expect([...iterateCsv("")]).toEqual([]);
  });
  it("el parser del script de auditoría es idéntico al del adaptador", () => {
    const tricky = '\uFEFFa,b\r\n"1,2","q""q"\r\n\r\n3,"x\ny"\r\n';
    expect([...audit.iterateCsv(tricky)]).toEqual([...iterateCsv(tricky)]);
  });
});

describe("adaptador Oracle's Elixir", () => {
  it("agrupa por gameid y devuelve el modelo interno con 10 jugadores", () => {
    const r = parseOraclesElixirCsv(csv(game("G2", {}), game("G1", { blueWins: false })), { now: NOW });
    expect(r.missingColumns).toEqual([]);
    expect(r.games.map((g) => g.externalId)).toEqual(["G1", "G2"]);
    const g = r.games[1];
    expect(g).toMatchObject({
      league: "LEC", year: 2026, split: "Spring", playoffs: false, playedOn: "2026-03-01", gameNumber: 1, patch: "15.5",
      dataComplete: true, winnerSide: "blue", durationSeconds: 1800,
      blueTeam: { externalId: "t-a", name: "Alpha" }, redTeam: { externalId: "t-b", name: "Beta" },
    });
    expect(g.meta).toEqual({ source: "oracleselixir", fetchedAt: "2026-10-16T10:00:00.000Z" });
    expect(g.players).toHaveLength(10);
    expect(g.players[0]).toMatchObject({
      participantId: 1, side: "blue", playerName: "Jug, 1", playerExternalId: "pl1", champion: "Ahri", won: true,
      kills: 1, deaths: 2, assists: 3, totalGold: 10000, damageToChampions: 20000.5, minionKills: 200, monsterKills: 10, wardsPlaced: 12,
    });
    expect(g.players[9]).toMatchObject({ participantId: 10, side: "red", won: false });
    expect(r.games[0].winnerSide).toBe("red");
    expect(r.warnings).toEqual([]);
  });
  it("acepta los nombres de columna antiguos del diccionario oficial", () => {
    const old = [
      "gameid,league,year,split,date,game,participantid,side,position,player,team,champion,gamelength,result,k,d,a,dmgtochamps,patchno",
      "O1,LCK,2019,Summer,2019-07-01,2,1,Blue,top,Alguien,Equipo X,Gnar,30.5,1,4,1,6,15000,9.13",
      "O1,LCK,2019,Summer,2019-07-01,2,100,Blue,team,,Equipo X,,30.5,1,,,,,9.13",
      "O1,LCK,2019,Summer,2019-07-01,2,200,Red,team,,Equipo Y,,30.5,0,,,,,9.13",
    ].join("\n");
    const r = parseOraclesElixirCsv(old, { gameLengthUnit: "minutes" });
    const g = r.games[0];
    expect(g.durationSeconds).toBe(1830);
    expect(g.players[0]).toMatchObject({ playerName: "Alguien", teamName: "Equipo X", kills: 4, deaths: 1, assists: 6, damageToChampions: 15000 });
    expect(g.patch).toBe("9.13");
    expect(r.warnings.map((w) => w.code)).toContain("wrong_player_count");
  });
  it("sin columnas obligatorias no devuelve partidas", () => {
    const r = parseOraclesElixirCsv("gameid,league\nX,LEC\n");
    expect(r.games).toEqual([]);
    expect(r.missingColumns.sort()).toEqual(["gamelength", "participantid", "result", "side"]);
  });
  it("avisa de unidades implausibles en lugar de corregirlas en silencio", () => {
    const r = parseOraclesElixirCsv(csv(game("S1", { length: 30.4 })));
    expect(r.games[0].durationSeconds).toBe(30);
    expect(r.warnings.some((w) => w.code === "suspicious_length")).toBe(true);
    const ok = parseOraclesElixirCsv(csv(game("S2", { length: 30.4 })), { gameLengthUnit: "minutes" });
    expect(ok.games[0].durationSeconds).toBe(1824);
    expect(ok.warnings).toEqual([]);
  });
  it("marca partidas incompletas o parciales sin descartarlas", () => {
    const r = parseOraclesElixirCsv(csv(game("P1", { players: 8 }), game("P2", { complete: "0" })));
    const codes = (id: string) => r.warnings.filter((w) => w.gameId === id).map((w) => w.code);
    expect(codes("P1")).toContain("wrong_player_count");
    expect(codes("P2")).toContain("partial_data");
    expect(r.games.find((g) => g.externalId === "P2")!.dataComplete).toBe(false);
    expect(r.games).toHaveLength(2);
  });
  it("cuenta las filas sin gameid o participantid válidos y tolera líneas en blanco", () => {
    const text = csv(game("Q1")) + "\r\n,1,LEC,2026,Spring,0,2026-03-01,1,15.5,3,Blue,mid,x,,,,,1800,1,0,0,0,,,,,\r\nQ9,1,LEC,2026,Spring,0,2026-03-01,1,15.5,abc,Blue,mid,x,,,,,1800,1,0,0,0,,,,,\r\n";
    const r = parseOraclesElixirCsv(text);
    expect(r.skippedRows).toBe(2);
    expect(r.games).toHaveLength(1);
  });
  it("sin ganador claro no inventa uno; fechas Excel antiguas quedan en null", () => {
    const g = csv(game("W1")).replace("2026-03-01 18:05:10", "43891.75");
    const r = parseOraclesElixirCsv(g.replace(/,100,Blue,team,,,Alpha,t-a,,1800,1,/, ",100,Blue,team,,,Alpha,t-a,,1800,,").replace(/,200,Red,team,,,Beta,t-b,,1800,0,/, ",200,Red,team,,,Beta,t-b,,1800,,"));
    expect(r.games[0].winnerSide).toBeNull();
    expect(r.games[0].playedOn).toBeNull();
  });
  it("genera identidades de equipos y jugadores sin duplicar", () => {
    const ids = gameIdentities(parseOraclesElixirCsv(csv(game("I1"), game("I2"))).games);
    expect(ids.filter((i) => i.kind === "team").map((i) => i.externalId).sort()).toEqual(["t-a", "t-b"]);
    expect(ids.filter((i) => i.kind === "player")).toHaveLength(10);
    expect(ids.every((i) => i.source === "oracleselixir")).toBe(true);
  });
});

// ── Auditoría (funciones puras) ────────────────────────────
describe("ayudas del auditor", () => {
  it("resume un CSV: columnas, partidas, unidad sugerida y muestra acotada", () => {
    const s = audit.summarizeOraclesElixir(csv(game("A1"), game("A2")), { sampleRows: 2 });
    expect(s.rows).toBe(24);
    expect(s.games).toBe(2);
    expect(s.missingRequired).toEqual([]);
    expect(s.participantIds["100"]).toBe(2);
    expect(s.gamelength).toMatchObject({ teamRowsMeasured: 4, min: 1800, max: 1800, median: 1800, suggestedUnit: "seconds" });
    expect(s.sampleRows).toHaveLength(2);
    expect(audit.summarizeOraclesElixir(csv(game("A3", { length: 30.5 }))).gamelength.suggestedUnit).toBe("minutes");
  });
  it("detecta columnas obligatorias ausentes", () => {
    expect(audit.summarizeOraclesElixir("gameid,league\n1,LEC\n").missingRequired).toEqual(["participantid", "side", "result", "gamelength"]);
  });
  it("compara los campos pedidos con los declarados", () => {
    expect(audit.compareFields(["a", "b", "c"], ["a", "c", "z"])).toEqual({ present: ["a", "c"], missing: ["b"] });
  });
  it("detecta errores de MediaWiki dentro de un 200", () => {
    expect(audit.detectMediaWikiError({ error: { code: "ratelimited" } })).toEqual({ code: "ratelimited", rateLimited: true });
    expect(audit.detectMediaWikiError({ error: { code: "x" } })).toEqual({ code: "x", rateLimited: false });
    expect(audit.detectMediaWikiError({ cargoquery: [] })).toBeNull();
    expect(audit.detectMediaWikiError(null)).toBeNull();
  });
  it("findFirst encuentra IDs anidados y rateLimitHeaders filtra cabeceras", () => {
    expect(audit.findFirst({ data: { items: [{ matchId: 5 }] } }, ["matchId", "id"])).toBe("5");
    expect(audit.findFirst({ a: [] }, ["id"])).toBeUndefined();
    const h = new Headers({ "x-ratelimit-remaining": "9", "content-type": "x", "retry-after": "3" });
    expect(Object.keys(audit.rateLimitHeaders(h)).sort()).toEqual(["retry-after", "x-ratelimit-remaining"]);
  });
  it("el script de auditoría no contiene claves ni imprime secretos", () => {
    const script = readFileSync(join(process.cwd(), "scripts/audit-sources.mjs"), "utf8");
    expect(script).not.toMatch(/console\.(log|error)\([^)]*\bkey\b[^)]*\)/i);
    expect(script).toContain("process.env.CITOAPI_KEY");
  });
});

// ── Equivalencias ──────────────────────────────────────────
const can = (id: string, kind: EntityRef["kind"] = "team"): EntityRef => ({ source: "pandascore", kind, externalId: id });
const ext = (source: EntityRef["source"], id: string, kind: EntityRef["kind"] = "team"): EntityRef => ({ source, kind, externalId: id });
const review = { reviewedBy: "ana", evidence: "Mismo equipo: confirmado en la web oficial", now: NOW };
const ident = (source: EntityIdentity["source"], externalId: string, name: string, acronym: string | null = null, kind: EntityIdentity["kind"] = "team"): EntityIdentity =>
  ({ source, kind, externalId, name, acronym, region: null });

describe("tabla de equivalencias", () => {
  it("el fichero de datos inicial es válido y está vacío (no se inventan equivalencias)", () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data/equivalences.json"), "utf8"));
    expect(loadEquivalences(raw)).toEqual([]);
  });
  it("confirmar exige revisor y evidencia", () => {
    expect(() => confirmEquivalence([], can("1"), ext("leaguepedia", "Alpha"), { ...review, reviewedBy: " " })).toThrowError(/quién revisa/);
    expect(() => confirmEquivalence([], can("1"), ext("leaguepedia", "Alpha"), { ...review, evidence: "" })).toThrowError(/evidencia/);
  });
  it("solo lo confirmado resuelve; propuestas y rechazos nunca", () => {
    const proposal = toProposedEntry(ident("leaguepedia", "Alpha", "Alpha"), { canonical: ident("pandascore", "1", "Alpha"), score: 3, reasons: ["nombre idéntico"] });
    expect(proposal).toMatchObject({ status: "proposed", method: "suggested", reviewedBy: null });
    expect(resolveCanonical([proposal], ext("leaguepedia", "Alpha"))).toBeNull();
    const confirmed = confirmEquivalence([proposal], can("1"), ext("leaguepedia", "Alpha"), review);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]).toMatchObject({ status: "confirmed", method: "suggested", reviewedBy: "ana", reviewedAt: "2026-10-16T10:00:00.000Z" });
    expect(resolveCanonical(confirmed, ext("leaguepedia", "Alpha"))).toEqual(can("1"));
    expect(resolveExternal(confirmed, can("1"), "leaguepedia")).toEqual(ext("leaguepedia", "Alpha"));
    expect(resolveExternal(confirmed, can("1"), "citoapi")).toBeNull();
    const rejected = rejectEquivalence([], can("2"), ext("leaguepedia", "Alpha"), review);
    expect(resolveCanonical(rejected, ext("leaguepedia", "Alpha"))).toBeNull();
  });
  it("no modifica el array original (inmutabilidad)", () => {
    const base: Equivalence[] = [];
    confirmEquivalence(base, can("1"), ext("leaguepedia", "A"), review);
    expect(base).toEqual([]);
  });
  it("impide contradicciones: un externo con dos canónicos, o un canónico con dos externos de la misma fuente", () => {
    const a = confirmEquivalence([], can("1"), ext("leaguepedia", "Alpha"), review);
    expect(() => confirmEquivalence(a, can("2"), ext("leaguepedia", "Alpha"), review)).toThrowError(/otro canónico/);
    expect(() => confirmEquivalence(a, can("1"), ext("leaguepedia", "Alpha 2"), review)).toThrowError(/ya tiene un externo confirmado/);
    // Otra fuente para el mismo canónico sí es válido.
    expect(confirmEquivalence(a, can("1"), ext("citoapi", "alpha"), review)).toHaveLength(2);
  });
  it("validateEquivalences detecta datos manipulados a mano", () => {
    const ok = confirmEquivalence([], can("1"), ext("leaguepedia", "A"), review)[0];
    const bad: Equivalence[] = [
      { ...ok, reviewedBy: null },
      { ...ok, canonical: { ...ok.canonical, source: "citoapi" } },
      { ...ok, external: { ...ok.external, source: "pandascore" } },
      { ...ok, external: { ...ok.external, kind: "player" } },
      { ...ok, status: "proposed", method: "manual", reviewedBy: null, reviewedAt: null },
      ok, ok,
    ];
    const messages = validateEquivalences(bad).map((i) => i.message).join("|");
    expect(messages).toMatch(/reviewedBy/);
    expect(messages).toMatch(/debe ser de pandascore/);
    expect(messages).toMatch(/no puede ser de la fuente canónica/);
    expect(messages).toMatch(/mismo tipo/);
    expect(messages).toMatch(/propuesta manual/);
    expect(messages).toMatch(/Par duplicado/);
  });
  it("loadEquivalences rechaza formato inválido e incoherencias", () => {
    expect(() => loadEquivalences({ version: 2, entries: [] })).toThrowError(/formato/);
    const ok = confirmEquivalence([], can("1"), ext("leaguepedia", "A"), review)[0];
    expect(() => loadEquivalences({ version: 1, entries: [ok, { ...ok, canonical: can("2") }] })).toThrowError(/incoherente/);
    expect(loadEquivalences({ version: 1, entries: [ok] })).toHaveLength(1);
  });
  it("las sugerencias nunca resuelven y marcan lo ambiguo", () => {
    const canon = [ident("pandascore", "1", "Equipo Único", "EUN"), ident("pandascore", "2", "equipo unico", "XXX"), ident("pandascore", "3", "Otro", "OTR")];
    const exts = [
      ident("leaguepedia", "Equipo Unico", "Equipo Unico"),
      ident("oracleselixir", "t9", "Otro Distinto", "OTR"),
      ident("citoapi", "zzz", "Sin relación"),
      ident("leaguepedia", "P", "Equipo Único", null, "player"),
    ];
    const props = suggestEquivalences(canon, exts);
    expect(props).toHaveLength(2);
    const first = props.find((p) => p.external.externalId === "Equipo Unico")!;
    expect(first.ambiguous).toBe(true);
    expect(first.candidates.map((c) => c.canonical.externalId).sort()).toEqual(["1", "2"]);
    const second = props.find((p) => p.external.externalId === "t9")!;
    expect(second.ambiguous).toBe(false);
    expect(second.candidates[0]).toMatchObject({ score: 2, reasons: ["siglas idénticas"] });
    expect(resolveCanonical([], ext("leaguepedia", "Equipo Unico"))).toBeNull();
  });
  it("no vuelve a proponer pares decididos ni externos ya resueltos", () => {
    const canon = [ident("pandascore", "1", "Alpha")];
    const exts = [ident("leaguepedia", "Alpha", "Alpha"), ident("citoapi", "alpha", "Alpha")];
    expect(suggestEquivalences(canon, exts)).toHaveLength(2);
    const rejected = rejectEquivalence([], can("1"), ext("leaguepedia", "Alpha"), { ...review, evidence: "Es otro equipo con el mismo nombre" });
    expect(suggestEquivalences(canon, exts, rejected).map((p) => p.external.source)).toEqual(["citoapi"]);
    const confirmed = confirmEquivalence([], can("1"), ext("citoapi", "alpha"), review);
    expect(suggestEquivalences(canon, exts, confirmed).map((p) => p.external.source)).toEqual(["leaguepedia"]);
  });
  it("la migración SQL replica las reglas (RLS sin políticas, un confirmado por externo y por canónico)", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0002_entity_equivalences.sql"), "utf8");
    expect(sql).toMatch(/alter table public\.entity_equivalences enable row level security/);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).toMatch(/unique index[^;]*one_confirmed_per_external[^;]*where status = 'confirmed'/s);
    expect(sql).toMatch(/unique index[^;]*one_confirmed_per_canonical_source[^;]*where status = 'confirmed'/s);
    expect(sql).toMatch(/canonical_source\s+text not null default 'pandascore' check \(canonical_source = 'pandascore'\)/);
    expect(sql).toMatch(/reviewed_by is not null/);
  });
});

// ── Seguridad ──────────────────────────────────────────────
describe("seguridad de los adaptadores", () => {
  it("las claves nunca viajan en la URL ni en NEXT_PUBLIC_*", () => {
    for (const file of ["citoapi.ts", "leaguepedia.ts", "oracleselixir.ts", "base.ts"]) {
      const src = readFileSync(join(process.cwd(), "src/lib/sources/adapters", file), "utf8");
      expect(src, file).not.toMatch(/NEXT_PUBLIC_/);
      expect(src, file).not.toMatch(/searchParams\.set\(["']?(api[_-]?key|key|token)/i);
    }
    const env = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    // Solo se admite mencionarlo en comentarios (para avisar); nunca como variable definida.
    expect(env.split("\n").filter((l) => !l.trimStart().startsWith("#"))).not.toContainEqual(expect.stringMatching(/NEXT_PUBLIC_/));
  });
  it("los módulos con red llevan server-only; el parser de CSV es puro", () => {
    const dir = join(process.cwd(), "src/lib/sources/adapters");
    for (const f of ["citoapi.ts", "leaguepedia.ts", "pandascore.ts", "index.ts"]) expect(readFileSync(join(dir, f), "utf8")).toMatch(/^import "server-only";/);
    const oe = readFileSync(join(dir, "oracleselixir.ts"), "utf8");
    expect(oe).not.toMatch(/fetch\(|node:fs|server-only/);
  });
});
