import { buildIcs, matchToEvent, parseAlarm } from "@/lib/ics";
import { parseId } from "@/lib/params";
import { DataSourceError } from "@/lib/services/errors";
import { getMatch } from "@/lib/services/lol";

export const dynamic = "force-dynamic";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return text("Partido no encontrado", 404);
  const url = new URL(req.url);

  try {
    const match = await getMatch(id);
    const event = matchToEvent(match, url.origin, parseAlarm(url.searchParams.get("aviso")));
    if (!event) return text("Este partido aún no tiene fecha confirmada.", 409);
    const ics = buildIcs([event], { name: "LoL Hub" });
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="partido-${id}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof DataSourceError && e.kind === "not_found") return text("Partido no encontrado", 404);
    return text(e instanceof DataSourceError ? e.userMessage : "Error inesperado.", 502);
  }
}
