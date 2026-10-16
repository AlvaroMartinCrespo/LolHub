import { FreshnessNotice } from "@/components/states/FreshnessNotice";
import type { Match } from "@/types/domain";
import { DataSourceError } from "@/lib/services/errors";
import { getRecentMatches, getRunningMatches, getUpcomingMatches } from "@/lib/services/lol";
import { HomeDashboard } from "@/components/home/HomeDashboard";

export const dynamic = "force-dynamic";

interface Loaded {
  matches: Match[];
  error: string | null;
}

async function load(fn: () => Promise<Match[]>): Promise<Loaded> {
  try {
    return { matches: await fn(), error: null };
  } catch (e) {
    return { matches: [], error: e instanceof DataSourceError ? e.userMessage : "Error inesperado." };
  }
}

export default async function Home() {
  const [upcoming, recent] = await Promise.all([
    load(async () => {
      // Directos + próximos. Si falla "en directo" (p. ej. plan), se siguen mostrando los próximos.
      const [running, next] = await Promise.all([
        getRunningMatches({ perPage: 50 }).then((p) => p.items).catch((): Match[] => []),
        getUpcomingMatches({ perPage: 100 }).then((p) => p.items),
      ]);
      const seen = new Set<number>();
      return [...running, ...next].filter((m) => !seen.has(m.id) && !!seen.add(m.id));
    }),
    load(() => getRecentMatches({ perPage: 100 }).then((p) => p.items)),
  ]);

  return (
    <div className="space-y-6">
      <FreshnessNotice />
      <HomeDashboard
        upcoming={upcoming.matches}
        recent={recent.matches}
        upcomingError={upcoming.error}
        recentError={recent.error}
      />
    </div>
  );
}
