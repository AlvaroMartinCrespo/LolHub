import { FreshnessNotice } from "@/components/states/FreshnessNotice";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { byLeague, getLeague, getRecentMatches, getTournaments, getUpcomingMatches } from "@/lib/services/lol";
import { loadEntity, safe } from "@/lib/services/safe";
import { parseId, parsePage } from "@/lib/params";
import { SafeImage } from "@/components/ui/SafeImage";
import { LocalTime } from "@/components/ui/LocalTime";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { MatchesSection } from "@/components/entity/MatchesSection";
import { PageError } from "@/components/entity/PageError";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  if (id === null) return { title: "Liga no encontrada · LoL Hub" };
  const l = await safe(() => getLeague(id));
  return { title: `${l.data?.name ?? "Liga"} · LoL Hub` };
}

export default async function LeaguePage({ params, searchParams }: Props) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const page = parsePage((await searchParams).page);

  const league = await loadEntity(() => getLeague(id));
  if (!league.data) return <PageError message={league.error ?? "Error inesperado."} />;
  const l = league.data;

  const [tournaments, upcoming, results] = await Promise.all([
    safe(() => getTournaments({ perPage: 20, filters: { "filter[league_id]": id } })),
    safe(() => getUpcomingMatches({ perPage: 12, filters: byLeague(id) })),
    safe(() => getRecentMatches({ perPage: 12, page, filters: byLeague(id) })),
  ]);

  return (
    <div className="space-y-10">
      <FreshnessNotice />
      <nav aria-label="Migas de pan"><Link href="/competiciones" className="text-sm text-accent">← Competiciones</Link></nav>
      <header className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
        <SafeImage src={l.imageUrl} alt={`Logo de ${l.name}`} fallbackName={l.name} size={72} />
        <h1 className="text-2xl font-semibold">{l.name}</h1>
      </header>

      <section aria-labelledby="fases" className="space-y-3">
        <h2 id="fases" className="text-xl font-semibold">Torneos y fases</h2>
        {tournaments.error ? (
          <ErrorState message={tournaments.error} />
        ) : !tournaments.data || tournaments.data.items.length === 0 ? (
          <EmptyState title="No hay torneos disponibles" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.data.items.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/torneos/${t.id}`}
                  className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="mt-1 block text-sm text-muted">
                    <LocalTime iso={t.startsAt} fallback="Fechas por confirmar" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MatchesSection id="calendario" title="Calendario" loaded={upcoming} emptyTitle="No hay partidos próximos" />
      <MatchesSection
        id="resultados"
        title="Resultados"
        loaded={results}
        emptyTitle="No hay resultados"
        pager={{ basePath: `/ligas/${id}`, page }}
      />
    </div>
  );
}
