import { authorize } from "@/lib/server/auth";
import { DataSourceError } from "@/lib/services/errors";
import { getLeagues, getRecentMatches, getRunningMatches, getUpcomingMatches } from "@/lib/services/lol";

export const dynamic = "force-dynamic";

/**
 * Precalienta la caché de datos. Es idempotente (solo lee de PandaScore) y seguro ante
 * invocaciones duplicadas: Vercel puede entregar el mismo evento de cron más de una vez.
 */
export async function GET(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;

  const jobs: Record<string, () => Promise<unknown>> = {
    leagues: () => getLeagues({ perPage: 100 }),
    running: () => getRunningMatches({ perPage: 50 }),
    upcoming: () => getUpcomingMatches({ perPage: 100 }),
    recent: () => getRecentMatches({ perPage: 100 }),
  };
  const names = Object.keys(jobs);
  const settled = await Promise.allSettled(names.map((n) => jobs[n]()));

  const results: Record<string, { ok: boolean; error?: string }> = {};
  settled.forEach((r, i) => {
    results[names[i]] =
      r.status === "fulfilled"
        ? { ok: true }
        : { ok: false, error: r.reason instanceof DataSourceError ? r.reason.kind : "unknown" };
  });
  const ok = Object.values(results).every((r) => r.ok);
  return Response.json({ ok, results, at: new Date().toISOString() }, { status: ok ? 200 : 207 });
}
