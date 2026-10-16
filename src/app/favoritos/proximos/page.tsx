import type { Metadata } from "next";
import Link from "next/link";
import type { Match } from "@/types/domain";
import { byTeam, getUpcomingMatches } from "@/lib/services/lol";
import { parseIdList } from "@/lib/dates";
import { sortUpcoming } from "@/lib/filters/matches";
import { MatchCard } from "@/components/MatchCard";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { FreshnessNotice } from "@/components/states/FreshnessNotice";
import { DataSourceError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Próximos partidos de tus favoritos · LoL Hub" };

export default async function FavoriteMatches({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const raw = (await searchParams).ids;
  const ids = parseIdList(Array.isArray(raw) ? raw[0] : raw);

  let matches: Match[] = [];
  let failed = 0;
  let lastError: string | null = null;
  if (ids.length > 0) {
    const results = await Promise.allSettled(ids.map((id) => getUpcomingMatches({ perPage: 10, filters: byTeam(id) })));
    const seen = new Set<number>();
    for (const r of results) {
      if (r.status === "fulfilled") {
        for (const m of r.value.items) if (!seen.has(m.id)) { seen.add(m.id); matches.push(m); }
      } else {
        failed++;
        lastError = r.reason instanceof DataSourceError ? r.reason.userMessage : "Error inesperado.";
      }
    }
    matches = sortUpcoming(matches);
  }

  return (
    <section aria-labelledby="prox" className="space-y-4">
      <FreshnessNotice />
      <nav aria-label="Migas de pan"><Link href="/favoritos" className="text-sm text-accent">← Favoritos</Link></nav>
      <h1 id="prox" className="text-2xl font-semibold">Próximos partidos de tus favoritos</h1>
      {ids.length === 0 ? (
        <EmptyState title="No hay equipos seleccionados" action={<Link href="/favoritos" className="text-accent">Ir a favoritos</Link>} />
      ) : (
        <>
          {failed > 0 && <ErrorState message={`No se pudieron cargar ${failed} de ${ids.length} equipos. ${lastError ?? ""}`} />}
          {matches.length === 0 && failed < ids.length ? (
            <EmptyState title="Sin partidos próximos" description="Ninguno de tus equipos tiene partidos programados en la fuente de datos." />
          ) : (
            <>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {matches.map((m) => <li key={m.id}><MatchCard match={m} href={`/partidos/${m.id}`} /></li>)}
              </ul>
              {matches.length > 0 && (
                <a href={`/favoritos/ics?ids=${ids.join(",")}`} className="inline-flex min-h-10 items-center rounded-md border border-border bg-surface px-3 text-sm">
                  Exportar al calendario (.ics)
                </a>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
