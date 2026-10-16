import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_FAVORITES, MAX_FAVORITES, isFavoriteTeam, parseFavorites, serializeFavorites, toggleTeam,
} from "@/lib/favorites/store";
import { addDays, dayWindow, parseDay, parseIdList, todayUtc } from "@/lib/dates";
import { ASSUMED_DURATION_MINUTES, buildIcs, escapeText, foldLine, formatUtc, matchToEvent, parseAlarm } from "@/lib/ics";
import { computeHeadToHead } from "@/lib/stats/headToHead";
import { computeRecords } from "@/lib/stats/records";
import { classifyInternationals } from "@/lib/internationals";
import { snapshot, remember } from "@/lib/services/last-good";
import { getUpstreamStatus, recordFailure, recordSuccess } from "@/lib/services/status";
import { getMatchesBetween, searchLeagues, searchPlayers } from "@/lib/services/lol";
import { finished, makeMatch, rawMatch, team } from "./fixtures";

describe("favoritos (almacén puro)", () => {
  it("añadir, quitar y consultar", () => {
    let f = toggleTeam(EMPTY_FAVORITES, { id: 1, name: "Alpha" });
    expect(isFavoriteTeam(f, 1)).toBe(true);
    f = toggleTeam(f, { id: 1, name: "Alpha" });
    expect(f.teams).toEqual([]);
  });
  it("respeta el máximo", () => {
    let f = EMPTY_FAVORITES;
    for (let i = 1; i <= MAX_FAVORITES + 5; i++) f = toggleTeam(f, { id: i, name: `T${i}` });
    expect(f.teams).toHaveLength(MAX_FAVORITES);
  });
  it("serializa y lee de vuelta", () => {
    const f = toggleTeam(EMPTY_FAVORITES, { id: 7, name: "Siete" });
    expect(parseFavorites(serializeFavorites(f))).toEqual(f);
  });
  it.each([null, "", "no json", "{}", '{"teams":"x"}', '{"teams":[{"id":"a","name":1},{"id":-3,"name":"x"}]}'])(
    "lectura tolerante de %j", (raw) => expect(parseFavorites(raw)).toEqual(EMPTY_FAVORITES),
  );
  it("descarta duplicados e inválidos manteniendo los buenos", () => {
    const raw = JSON.stringify({ teams: [{ id: 1, name: "A" }, { id: 1, name: "A2" }, { id: 2 }, { id: 3, name: "C" }] });
    expect(parseFavorites(raw).teams.map((t) => t.id)).toEqual([1, 3]);
  });
});

describe("fechas", () => {
  it("parseDay valida formato y existencia", () => {
    expect(parseDay("2026-10-15")).toBe("2026-10-15");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("15/10/2026")).toBeNull();
    expect(parseDay(undefined)).toBeNull();
  });
  it("addDays cruza mes y año", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("todayUtc y dayWindow", () => {
    expect(todayUtc(new Date("2026-10-15T23:59:00Z"))).toBe("2026-10-15");
    expect(dayWindow("2026-10-15")).toEqual({ from: "2026-10-14T00:00:00Z", to: "2026-10-17T00:00:00Z" });
  });
  it("parseIdList limpia, deduplica y limita", () => {
    expect(parseIdList("1,2,2,x,3")).toEqual([1, 2, 3]);
    expect(parseIdList("1,2,3", 2)).toEqual([1, 2]);
    expect(parseIdList(null)).toEqual([]);
  });
});

describe("iCalendar", () => {
  const m = makeMatch({ id: 42, status: "scheduled", startTime: "2026-10-20T18:00:00.000Z", bestOf: 5 });

  it("formato de fecha UTC", () => expect(formatUtc("2026-10-20T18:00:00.000Z")).toBe("20261020T180000Z"));
  it("escapa caracteres especiales", () => expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne"));
  it("pliega a 75 octetos y se puede desplegar sin pérdida (UTF-8)", () => {
    const long = "Ñandú ".repeat(40) + "fin";
    const folded = foldLine(`SUMMARY:${long}`);
    const enc = new TextEncoder();
    for (const l of folded.split("\r\n")) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${long}`);
  });
  it("evento con recordatorio, fin estimado y URL", () => {
    const e = matchToEvent(m, "https://x.test", 30)!;
    expect(e.uid).toBe("lolhub-match-42@lolhub");
    expect(new Date(e.end).getTime() - new Date(e.start).getTime()).toBe(ASSUMED_DURATION_MINUTES * 60_000);
    expect(e.url).toBe("https://x.test/partidos/42");
    const ics = buildIcs([e], { name: "LoL Hub", now: new Date("2026-10-15T10:00:00Z") });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261020T180000Z");
    expect(ics).toContain("DTSTAMP:20261015T100000Z");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
  });
  it("sin recordatorio no hay VALARM; aplazado es provisional", () => {
    const e = matchToEvent({ ...m, status: "postponed" }, "https://x.test", 0)!;
    const ics = buildIcs([e], { name: "x" });
    expect(ics).not.toContain("VALARM");
    expect(ics).toContain("STATUS:TENTATIVE");
  });
  it("sin fecha → sin evento", () => expect(matchToEvent(makeMatch({ id: 1, startTime: null }), "https://x.test")).toBeNull());
  it("parseAlarm solo admite valores permitidos", () => {
    expect(parseAlarm("60")).toBe(60);
    expect(parseAlarm("0")).toBe(0);
    expect(parseAlarm("7")).toBe(15);
    expect(parseAlarm(null)).toBe(15);
    expect(parseAlarm("")).toBe(15);
  });
});

describe("enfrentamientos directos", () => {
  const ab = [finished(1, 1, 2, 0), finished(2, 2, 1, 2), finished(3, 1, 2, 1)];
  const other = makeMatch({ id: 9, status: "finished", sides: [
    { team: team(1, "Alpha"), score: 2 }, { team: team(7, "Otro"), score: 0 }], winnerTeamId: 1 });
  it("cuenta series y mapas, ordena por fecha y deduplica", () => {
    const h = computeHeadToHead([...ab, ...ab, other], 1, 2);
    expect(h.matches.map((m) => m.id)).toEqual([3, 2, 1]);
    expect(h.aWins).toBe(2);
    expect(h.bWins).toBe(1);
    expect(h.mapsA).toBe(5);
    expect(h.mapsB).toBe(3);
  });
  it("incomparecencias y sin ganador se listan pero no cuentan", () => {
    const h = computeHeadToHead([finished(1, 1, 2, 0, { forfeit: true }), finished(2, 1, 1, 1, { winnerTeamId: null })], 1, 2);
    expect(h.matches).toHaveLength(2);
    expect(h.notCounted).toBe(2);
    expect(h.aWins + h.bWins).toBe(0);
  });
  it("sin enfrentamientos", () => expect(computeHeadToHead([other], 1, 2).matches).toEqual([]));
});

describe("récords", () => {
  // Orden cronológico (por día): 1 W, 2 W, 3 W, 4 L, 5 L, 6 W
  const ms = [finished(1, 1, 2, 0), finished(2, 1, 2, 1), finished(3, 1, 2, 0), finished(4, 2, 0, 2), finished(5, 2, 1, 2), finished(6, 1, 2, 1)];
  it("rachas", () => {
    const r = computeRecords(ms, 1);
    expect(r.longestWinStreak).toBe(3);
    expect(r.longestLossStreak).toBe(2);
    expect(r.series).toBe(6);
  });
  it("mayor victoria: la de más diferencia (a igualdad, la más reciente)", () => {
    const r = computeRecords(ms, 1);
    expect(r.biggestWin).toMatchObject({ margin: 2, score: "2–0", matchId: 3 });
  });
  it("partida más larga y más corta con duraciones", () => {
    const a = finished(1, 1, 1, 0);
    a.games[0].durationSeconds = 1500;
    const b = finished(2, 1, 1, 0);
    b.games[0].durationSeconds = 2400;
    const c = finished(3, 1, 1, 0);
    c.games[0].durationSeconds = 0; // se ignora
    const r = computeRecords([a, b, c], 1);
    expect(r.longestGame).toEqual({ seconds: 2400, matchId: 2 });
    expect(r.shortestGame).toEqual({ seconds: 1500, matchId: 1 });
  });
  it("sin series → ceros y nulos", () => {
    expect(computeRecords([], 1)).toMatchObject({ series: 0, longestWinStreak: 0, longestGame: null, biggestWin: null });
  });
});

describe("Worlds / MSI", () => {
  const l = (id: number, name: string) => ({ id, name, slug: null, imageUrl: null });
  it("clasifica por nombre, deduplica y pone primero el nombre exacto", () => {
    const c = classifyInternationals([
      l(1, "Worlds Qualifying Series"), l(2, "Worlds"), l(3, "MSI"), l(3, "MSI"),
      l(4, "Mid-Season Invitational Play-In"), l(5, "LEC"), l(6, "World Championship"),
    ]);
    expect(c.worlds.map((x) => x.id)).toEqual([2, 6, 1]); // exacto primero; resto por nombre
    expect(c.msi.map((x) => x.id)).toEqual([3, 4]);
  });
  it("sin coincidencias → vacío", () => {
    expect(classifyInternationals([l(1, "LEC")])).toEqual({ worlds: [], msi: [] });
  });
});

describe("estado de la fuente", () => {
  it("registra éxito, cuota y fallo", () => {
    recordSuccess(850, 1000);
    recordFailure("server", 2000);
    expect(getUpstreamStatus()).toEqual({ lastSuccessAt: 1000, lastRateLimitRemaining: 850, lastFailure: { at: 2000, kind: "server" } });
    recordSuccess(null, 3000);
    expect(getUpstreamStatus().lastRateLimitRemaining).toBe(850);
  });
  it("snapshot ordena de más reciente a más antigua y caduca a las 24 h", () => {
    const now = Date.now();
    remember("https://a.test/1", {}, now - 5000);
    remember("https://a.test/2", {}, now - 1000);
    remember("https://a.test/old", {}, now - 25 * 3600 * 1000);
    const keys = snapshot(now).map((e) => e.key).filter((k) => k.startsWith("https://a.test/"));
    expect(keys).toEqual(["https://a.test/2", "https://a.test/1"]);
  });
});

describe("servicios nuevos (fetch simulado)", () => {
  const calls: URL[] = [];
  function mock(...bodies: unknown[]) {
    calls.length = 0;
    let i = 0;
    vi.stubGlobal("fetch", async (url: URL | string) => {
      calls.push(new URL(url.toString()));
      return new Response(JSON.stringify(bodies[Math.min(i++, bodies.length - 1)]), { status: 200, headers: { "x-per-page": "100" } });
    });
  }
  beforeEach(() => { process.env.PANDASCORE_API_TOKEN = "t"; });
  afterEach(() => vi.unstubAllGlobals());

  it("getMatchesBetween: ventana, orden y segunda página si la primera está llena", async () => {
    const full = Array.from({ length: 100 }, (_, i) => rawMatch(i + 1));
    mock(full, [rawMatch(101)]);
    const r = await getMatchesBetween("2026-10-14T00:00:00Z", "2026-10-17T00:00:00Z", "upcoming");
    expect(calls).toHaveLength(2);
    expect(calls[0].pathname).toBe("/lol/matches");
    expect(calls[0].searchParams.get("range[scheduled_at]")).toBe("2026-10-14T00:00:00Z,2026-10-17T00:00:00Z");
    expect(calls[0].searchParams.get("sort")).toBe("scheduled_at");
    expect(calls[1].searchParams.get("page[number]")).toBe("2");
    expect(r.matches).toHaveLength(101);
    expect(r.truncated).toBe(false);
  });
  it("getMatchesBetween avisa de truncado", async () => {
    mock(Array.from({ length: 100 }, (_, i) => rawMatch(i + 1)));
    expect((await getMatchesBetween("a", "b", "upcoming", 2)).truncated).toBe(true);
  });
  it("searchPlayers y searchLeagues usan search[name] y recortan la consulta", async () => {
    mock([{ id: 1, name: "P" }]);
    await searchPlayers("x".repeat(200));
    expect(calls[0].pathname).toBe("/lol/players");
    expect(calls[0].searchParams.get("search[name]")).toHaveLength(60);
    mock([{ id: 2, name: "Worlds" }]);
    const p = await searchLeagues("worlds", 10);
    expect(calls[0].searchParams.get("page[size]")).toBe("10");
    expect(p.items[0].name).toBe("Worlds");
  });
});
