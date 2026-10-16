import type { Metadata } from "next";
import Link from "next/link";
import { getArchivedLeagues } from "@/lib/sources/result-archive";
import { safe } from "@/lib/services/safe";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LocalTime } from "@/components/ui/LocalTime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Archivo de resultados · LoL Hub" };

export default async function ArchivePage() {
  const archived = await safe(getArchivedLeagues);

  return (
    <section aria-labelledby="archive-title" className="space-y-5">
      <h1 id="archive-title" className="text-2xl font-semibold">Archivo de resultados</h1>
      {archived.error ? (
        <ErrorState message={archived.error} />
      ) : !archived.data || archived.data.length === 0 ? (
        <EmptyState
          title="Aún no hay resultados archivados"
          description="Los resultados finalizados se irán guardando conforme se consulten."
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {archived.data.map((league) => (
            <li key={league.league_id}>
              <Link
                href={`/archivo/${league.league_id}`}
                className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-3 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="font-medium">{league.league_name}</span>
                <span className="text-sm text-muted">
                  Último resultado: <LocalTime iso={league.last_result_at} fallback="Fecha no disponible" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}