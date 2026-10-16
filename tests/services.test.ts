import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataSourceError } from "@/lib/services/errors";
import { pandaScoreFetch, parseList } from "@/lib/services/pandascore-client";
import {
  getLeagues, getMatch, getRecentMatches, getTeam, getTeamHistory, getTournamentStandings, getUpcomingMatches,
} from "@/lib/services/lol";
import { psLeagueSchema } from "@/lib/schemas/pandascore";
import { REVALIDATE } from "@/lib/cache/revalidate";
import { rawMatch } from "./fixtures";

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | Error;
const calls: { url: URL; init: RequestInit & { next?: { revalidate?: number | false } } }[] = [];

/** Sustituye fetch: cada llamada consume la siguiente respuesta; la última se repite. */
function mockFetch(...replies: Reply[]) {
  calls.length = 0;
  let i = 0;
  vi.stubGlobal("fetch", async (url: URL | string, init: RequestInit = {}) => {
    calls.push({ url: new URL(url.toString()), init });
    const r = replies[Math.min(i++, replies.length - 1)];
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body ?? []), { status: r.status ?? 200, headers: r.headers });
  });
}
/** Ejecuta una promesa que usa esperas de reintento con temporizadores simulados. */
async function run<T>(p: Promise<T>): Promise<T> {
  const settled = p.then((v) => ({ v }), (e) => ({ e }));
  await vi.runAllTimersAsync();
  const r = await settled;
  if ("e" in r) throw r.e;
  return r.v;
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.PANDASCORE_API_TOKEN = "token-de-prueba";
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("cliente PandaScore", () => {
  it("envía el token como Bearer y parámetros de paginación", async () => {
    mockFetch({ body: [{ id: 1, name: "L" }], headers: { "x-page": "2", "x-per-page": "10", "x-total": "55", "x-rate-limit-remaining": "900" } });
    const page = await run(getLeagues({ page: 2, perPage: 10 }));
    const c = calls[0];
    expect(c.init.headers).toMatchObject({ Authorization: "Bearer token-de-prueba" });
    expect(c.url.pathname).toBe("/lol/leagues");
    expect(c.url.searchParams.get("page[number]")).toBe("2");
    expect(c.url.searchParams.get("page[size]")).toBe("10");
    expect(page).toMatchObject({ page: 2, perPage: 10, total: 55, skipped: 0 });
  });

  it("limita el tamaño de página a 100 y la página mínima a 1", async () => {
    mockFetch({ body: [] });
    await run(getLeagues({ page: -5, perPage: 9999 }));
    expect(calls[0].url.searchParams.get("page[size]")).toBe("100");
    expect(calls[0].url.searchParams.get("page[number]")).toBe("1");
  });

  it("aplica la revalidación según el tipo de dato", async () => {
    mockFetch({ body: [] });
    await run(getUpcomingMatches());
    expect(calls[0].init.next?.revalidate).toBe(REVALIDATE.upcoming);
    await run(getRecentMatches());
    expect(calls[1].init.next?.revalidate).toBe(REVALIDATE.finished);
    await run(getRecentMatches({}, "historical"));
    expect(calls[2].init.next?.revalidate).toBe(REVALIDATE.historical);
  });

  it("sin token → error de configuración sin llamar a la API", async () => {
    delete process.env.PANDASCORE_API_TOKEN;
    mockFetch({ body: [] });
    await expect(run(getLeagues())).rejects.toMatchObject({ kind: "config" });
    expect(calls).toHaveLength(0);
  });

  it.each([
    [401, "unauthorized"], [403, "forbidden"], [404, "not_found"],
  ] as const)("HTTP %i → %s sin reintentos", async (status, kind) => {
    mockFetch({ status });
    await expect(run(pandaScoreFetch(`/x/${status}`))).rejects.toMatchObject({ kind, status });
    expect(calls).toHaveLength(1);
  });

  it("429 se reintenta con espera y se recupera", async () => {
    mockFetch({ status: 429, headers: { "retry-after": "1" } }, { body: [{ id: 1 }] });
    const res = await run(pandaScoreFetch("/lol/retry429"));
    expect(res.body).toEqual([{ id: 1 }]);
    expect(calls).toHaveLength(2);
  });

  it("5xx persistente: 3 intentos y error server", async () => {
    mockFetch({ status: 503 });
    await expect(run(pandaScoreFetch("/lol/retry5xx"))).rejects.toMatchObject({ kind: "server" });
    expect(calls).toHaveLength(3);
  });

  it("fallo de red se reintenta", async () => {
    mockFetch(new Error("ECONNRESET"), { body: [] });
    await run(pandaScoreFetch("/lol/retrynet"));
    expect(calls).toHaveLength(2);
  });

  it("respuesta no JSON → invalid", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>", { status: 200 }));
    await expect(run(pandaScoreFetch("/lol/notjson"))).rejects.toMatchObject({ kind: "invalid" });
  });

  it("datos de reserva ante fallo transitorio; no ante 401", async () => {
    mockFetch({ body: [{ id: 7 }] });
    const fresh = await run(pandaScoreFetch("/lol/reserva"));
    expect(fresh.staleSince).toBeNull();
    expect(fresh.fetchedAt).toMatch(/^\d{4}-\d\d-\d\dT/);

    mockFetch({ status: 500 });
    const stale = await run(pandaScoreFetch("/lol/reserva"));
    expect(stale.body).toEqual([{ id: 7 }]);
    expect(stale.staleSince).not.toBeNull();
    expect(stale.fetchedAt).toBe(fresh.fetchedAt);

    mockFetch({ status: 401 });
    await expect(run(pandaScoreFetch("/lol/reserva"))).rejects.toMatchObject({ kind: "unauthorized" });

    mockFetch({ status: 500 });
    await expect(run(pandaScoreFetch("/lol/reserva", {}, "catalog", { allowStale: false }))).rejects.toBeInstanceOf(DataSourceError);
  });
});

describe("validación", () => {
  it("descarta elementos inválidos y los cuenta", () => {
    const { items, skipped } = parseList([{ id: 1 }, { nombre: "sin id" }, { id: 3 }], psLeagueSchema);
    expect(items).toHaveLength(2);
    expect(skipped).toBe(1);
  });
  it("si ninguno es válido → error", () => {
    expect(() => parseList([{ x: 1 }], psLeagueSchema)).toThrow(DataSourceError);
  });
  it("no-lista → error; lista vacía → vacía", () => {
    expect(() => parseList({}, psLeagueSchema)).toThrow(DataSourceError);
    expect(parseList([], psLeagueSchema)).toEqual({ items: [], skipped: 0 });
  });
});

describe("servicios", () => {
  it("getUpcomingMatches normaliza al modelo interno", async () => {
    mockFetch({ body: [rawMatch(1), { broken: true }] });
    const page = await run(getUpcomingMatches({ filters: { "filter[league_id]": 1 } }));
    expect(page.items).toHaveLength(1);
    expect(page.skipped).toBe(1);
    expect(page.items[0]).toMatchObject({ id: 1, status: "scheduled", bestOf: 3 });
    expect(calls[0].url.searchParams.get("filter[league_id]")).toBe("1");
    expect(calls[0].url.searchParams.get("sort")).toBe("scheduled_at");
  });

  it("getMatch / getTeam devuelven entidades normalizadas", async () => {
    mockFetch({ body: rawMatch(5, { status: "finished", winner_id: 1 }) });
    expect(await run(getMatch(5))).toMatchObject({ id: 5, status: "finished", winnerTeamId: 1 });
    mockFetch({ body: { id: 3, name: " Alpha ", location: "ES", players: [{ id: 9, name: "P", first_name: "A", last_name: "B" }] } });
    const t = await run(getTeam(3));
    expect(t).toMatchObject({ id: 3, name: "Alpha", region: "ES" });
    expect(t.roster[0]).toMatchObject({ id: 9, fullName: "A B" });
  });

  it("getMatch inexistente → not_found", async () => {
    mockFetch({ status: 404 });
    await expect(run(getMatch(404404))).rejects.toMatchObject({ kind: "not_found" });
  });

  it("clasificación ordenada por posición", async () => {
    mockFetch({ body: [
      { rank: 2, wins: 3, losses: 4, team: { id: 2, name: "B" } },
      { rank: 1, wins: 6, losses: 1, team: { id: 1, name: "A" } },
    ] });
    const s = await run(getTournamentStandings(1));
    expect(s.map((x) => x.team.name)).toEqual(["A", "B"]);
  });

  it("getTeamHistory pagina hasta 3 veces y avisa de truncado", async () => {
    const full = Array.from({ length: 100 }, (_, i) => rawMatch(i + 1));
    mockFetch({ body: full, headers: { "x-per-page": "100" } });
    const h = await run(getTeamHistory(1));
    expect(calls).toHaveLength(3);
    expect(h.truncated).toBe(true);
    expect(h.matches).toHaveLength(300);
  });

  it("getTeamHistory se detiene en la primera página incompleta", async () => {
    mockFetch({ body: [rawMatch(1), rawMatch(2)], headers: { "x-per-page": "100" } });
    const h = await run(getTeamHistory(2));
    expect(calls).toHaveLength(1);
    expect(h.truncated).toBe(false);
  });
});
