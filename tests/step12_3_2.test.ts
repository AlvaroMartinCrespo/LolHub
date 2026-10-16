import { describe, expect, it, vi } from "vitest";
import { DataSourceError } from "@/lib/services/errors";
import { resolveSource } from "@/lib/sources/adapters";
import { createSourceSnapshotStore } from "@/lib/sources/snapshots";
import { createOracleElixirStore } from "@/lib/sources/oracleselixir-store";
import { createResultArchiveStore } from "@/lib/sources/result-archive";

describe("resolución unificada de fuentes", () => {
  it("selecciona el adaptador y conserva la política de la ruta", () => {
    const result = resolveSource("schedule", { perVisit: true });

    expect(result.route.source).toBe("pandascore");
    expect(result.route.onFailure).toBe("last-valid-with-notice");
    expect(result.adapter?.id).toBe("pandascore");
  });

  it("resuelve fuentes importadas sin permitir consultas por visita", () => {
    const result = resolveSource("matchStats", { perVisit: false });

    expect(result.route.mode).toBe("imported");
    expect(result.adapter?.id).toBe("oracleselixir");
    expect(() => resolveSource("matchStats", { perVisit: true })).toThrowError(DataSourceError);
  });

  it("devuelve rutas sin adaptador para CDN estático y bloquea integraciones futuras", () => {
    const staticResult = resolveSource("championAssets", { perVisit: true });

    expect(staticResult.route.mode).toBe("static-cdn");
    expect(staticResult.adapter).toBeNull();
    expect(() => resolveSource("soloQueue", { perVisit: false })).toThrowError(DataSourceError);
  });
});

describe("lectura de Oracle's Elixir desde la tabla importada", () => {
  it("filtra las filas por gameid y conserva los encabezados originales", async () => {
    const rows = [{ gameid: "LCK_2025_1", participantid: "1", "team kpm": "0.5" }];
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows)));
    const store = createOracleElixirStore({ url: "https://db.example/", serviceRoleKey: "server-secret" }, fetchImpl);

    await expect(store.readRowsForGame("LCK_2025_1", "LCK")).resolves.toEqual(rows);

    const [requestUrl, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(requestUrl));
    expect(url.pathname).toBe("/rest/v1/oracle_elixir_2025");
    expect(url.searchParams.get("gameid")).toBe("eq.LCK_2025_1");
    expect(url.searchParams.get("league")).toBe("eq.LCK");
    expect(url.searchParams.get("select")).toBe("*");
    expect((init as RequestInit).headers).toMatchObject({
      apikey: "server-secret",
      Authorization: "Bearer server-secret",
      Range: "0-99",
    });
  });
});

describe("archivo persistente de resultados", () => {
  const match = {
    id: 42,
    name: "Final",
    status: "finished" as const,
    startTime: "2026-10-15T10:00:00.000Z",
    endTime: "2026-10-15T11:00:00.000Z",
    bestOf: 3,
    league: { id: 7, name: "Liga de prueba", slug: "liga-prueba", imageUrl: null },
    serieName: null,
    tournamentName: "Split 2026",
    tournamentId: 8,
    sides: null,
    winnerTeamId: null,
    forfeit: false,
    games: [],
  };

  it("archiva solo partidos finalizados y hace upsert por partido y liga", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const store = createResultArchiveStore({ url: "https://db.example", serviceRoleKey: "server-secret" }, fetchImpl);

    await store.write([match, { ...match, id: 43, status: "scheduled" }]);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const leagueCall = fetchImpl.mock.calls.find(([url]) => String(url).includes("match_result_archive_leagues"));
    const matchesCall = fetchImpl.mock.calls.find(([url]) => String(url).includes("/match_result_archive?"));
    const leagueRows = JSON.parse(String((leagueCall?.[1] as RequestInit).body));
    const matchRows = JSON.parse(String((matchesCall?.[1] as RequestInit).body));
    expect(leagueRows).toHaveLength(1);
    expect(leagueRows[0]).toMatchObject({
      league_id: 7,
      league_name: "Liga de prueba",
      last_result_at: "2026-10-15T11:00:00.000Z",
    });
    expect(Date.parse(leagueRows[0].updated_at)).not.toBeNaN();
    expect(matchRows).toHaveLength(1);
    expect(matchRows[0]).toMatchObject({
      match_id: 42,
      league_id: 7,
      played_at: "2026-10-15T11:00:00.000Z",
      payload: match,
    });
    expect(Date.parse(matchRows[0].updated_at)).not.toBeNaN();
    expect(new URL(String(leagueCall?.[0])).searchParams.get("on_conflict")).toBe("league_id");
    expect(new URL(String(matchesCall?.[0])).searchParams.get("on_conflict")).toBe("match_id");
  });

  it("lee resultados paginados por liga desde el archivo", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ payload: match }]), {
      headers: { "content-range": "0-0/1" },
    }));
    const store = createResultArchiveStore({ url: "https://db.example", serviceRoleKey: "server-secret" }, fetchImpl);

    await expect(store.listLeagueMatches(7, 1)).resolves.toEqual({ items: [match], total: 1 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(String(url)).searchParams.get("league_id")).toBe("eq.7");
    expect((init as RequestInit).headers).toMatchObject({ Range: "0-23", Prefer: "count=exact" });
  });
});

describe("almacenamiento de snapshots de fuentes", () => {
  it("lee el payload y updated_at de una fila de Supabase", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { payload: { body: [1, 2] }, updated_at: "2026-10-16T10:00:00.000Z" },
    ])));
    const store = createSourceSnapshotStore({ url: "https://db.example/", serviceRoleKey: "server-secret" }, fetchImpl);

    const result = await store.read("pandascore", "https://api.example/matches?page=2");

    expect(result).toEqual({ payload: { body: [1, 2] }, updatedAt: "2026-10-16T10:00:00.000Z" });
    const [requestUrl, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(requestUrl));
    expect(url.pathname).toBe("/rest/v1/source_snapshots");
    expect(url.searchParams.get("source")).toBe("eq.pandascore");
    expect(url.searchParams.get("cache_key")).toBe("eq.https://api.example/matches?page=2");
    expect((init as RequestInit).headers).toMatchObject({ apikey: "server-secret", Authorization: "Bearer server-secret" });
  });

  it("hace upsert idempotente por fuente y clave", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const store = createSourceSnapshotStore({ url: "https://db.example", serviceRoleKey: "server-secret" }, fetchImpl);
    const updatedAt = "2026-10-16T10:00:00.000Z";

    await store.write("pandascore", "key", { items: [] }, updatedAt);

    const [requestUrl, init] = fetchImpl.mock.calls[0];
    expect(new URL(String(requestUrl)).searchParams.get("on_conflict")).toBe("source,cache_key");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({ Prefer: "resolution=merge-duplicates,return=minimal" });
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      source: "pandascore", cache_key: "key", payload: { items: [] }, updated_at: updatedAt,
    });
  });

  it("ignora filas corruptas y propaga errores HTTP para que el llamador los maneje", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ payload: {}, updated_at: "invalid" }])))
      .mockResolvedValueOnce(new Response("", { status: 503 }));
    const store = createSourceSnapshotStore({ url: "https://db.example", serviceRoleKey: "server-secret" }, fetchImpl);

    await expect(store.read("pandascore", "key")).resolves.toBeNull();
    await expect(store.read("pandascore", "key")).rejects.toThrow("Supabase snapshot read failed (503)");
  });
});