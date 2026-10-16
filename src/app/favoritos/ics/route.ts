import { buildIcs, matchToEvent, parseAlarm, type IcsEvent } from "@/lib/ics";
import { parseIdList } from "@/lib/dates";
import { DataSourceError } from "@/lib/services/errors";
import { byTeam, getUpcomingMatches } from "@/lib/services/lol";

export const dynamic = "force-dynamic";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = parseIdList(url.searchParams.get("ids"));
  if (ids.length === 0) return text("Faltan equipos (ids).", 400);
  const alarm = parseAlarm(url.searchParams.get("aviso"));

  const results = await Promise.allSettled(ids.map((id) => getUpcomingMatches({ perPage: 20, filters: byTeam(id) })));
  const events = new Map<string, IcsEvent>();
  let failures = 0;
  let lastError = "";
  for (const r of results) {
    if (r.status === "rejected") {
      failures++;
      lastError = r.reason instanceof DataSourceError ? r.reason.userMessage : "Error inesperado.";
      continue;
    }
    for (const m of r.value.items) {
      const e = matchToEvent(m, url.origin, alarm);
      if (e) events.set(e.uid, e);
    }
  }
  if (failures === ids.length) return text(lastError, 502);

  const ics = buildIcs([...events.values()].sort((a, b) => a.start.localeCompare(b.start)), { name: "LoL Hub · Favoritos" });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lolhub-favoritos.ics"',
      "Cache-Control": "no-store",
    },
  });
}
