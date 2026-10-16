import { authorize } from "@/lib/server/auth";
import { DataSourceError } from "@/lib/services/errors";
import { pandaScoreFetch } from "@/lib/services/pandascore-client";

export const dynamic = "force-dynamic";

/** Estado de la conexión con PandaScore y cuota restante. Sin caché y sin datos de reserva. */
export async function GET(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;

  const checkedAt = new Date().toISOString();
  try {
    const res = await pandaScoreFetch("/lol/leagues", { "page[size]": 1 }, "health", { allowStale: false });
    return Response.json({ ok: true, upstream: "ok", rateLimitRemaining: res.rateLimitRemaining, checkedAt });
  } catch (e) {
    const err = e instanceof DataSourceError ? e : null;
    return Response.json(
      { ok: false, upstream: err?.kind ?? "unknown", status: err?.status ?? null, checkedAt },
      { status: 502 },
    );
  }
}
