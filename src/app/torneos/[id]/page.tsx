import { FreshnessNotice } from "@/components/states/FreshnessNotice";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  byTournament, getRecentMatches, getTournament, getTournamentStandings, getUpcomingMatches,
} from "@/lib/services/lol";
import { loadEntity, safe } from "@/lib/services/safe";
import { parseId, parsePage } from "@/lib/params";
import { LocalTime } from "@/components/ui/LocalTime";
import { EmptyState } from "@/components/states/EmptyState";
import { MatchesSection } from "@/components/entity/MatchesSection";
import { PageError } from "@/components/entity/PageError";
import { StandingsTable } from "@/components/entity/StandingsTable";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  if (id === null) return { title: "Torneo no encontrado · LoL Hub" };
  const t = await safe(() => getTournament(id));
  return { title: `${t.data?.name ?? "Torneo"} · LoL Hub` };
}

export default async function TournamentPage({ params, searchParams }: Props) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const page = parsePage((await searchParams).page);

  const tournament = await loadEntity(() => getTournament(id));
  if (!tournament.data) return <PageError message={tournament.error ?? "Error inesperado."} />;
  const t = tournament.data;

  const [standings, upcoming, results] = await Promise.all([
    safe(() => getTournamentStandings(id)),
    safe(() => getUpcomingMatches({ perPage: 12, filters: byTournament(id) })),
    safe(() => getRecentMatches({ perPage: 12, page, filters: byTournament(id) })),
  ]);

  return (
    <div className="space-y-10">
      <FreshnessNotice />
      <nav aria-label="Migas de pan">
        {t.leagueId !== null ? (
          <Link href={`/ligas/${t.leagueId}`} className="text-sm text-accent">← Liga</Link>
        ) : (
          <Link href="/competiciones" className="text-sm text-accent">← Competiciones</Link>
        )}
      </nav>
      <header className="rounded-lg border border-border bg-surface p-5">
        <h1 className="text-2xl font-semibold">{t.name}</h1>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <div className="flex gap-1"><dt className="text-muted">Inicio:</dt><dd><LocalTime iso={t.startsAt} fallback="Sin datos" /></dd></div>
          <div className="flex gap-1"><dt className="text-muted">Fin:</dt><dd><LocalTime iso={t.endsAt} fallback="Sin datos" /></dd></div>
          {t.tier && <div className="flex gap-1"><dt className="text-muted">Nivel:</dt><dd>{t.tier}</dd></div>}
        </dl>
      </header>

      <section aria-labelledby="clasificacion" className="space-y-3">
        <h2 id="clasificacion" className="text-xl font-semibold">Clasificación</h2>
        {standings.data && standings.data.length > 0 ? (
          <StandingsTable standings={standings.data} />
        ) : (
          <EmptyState
            title="Clasificación no disponible"
            description={standings.error ?? "La fuente no proporciona clasificación para este torneo (puede ser un formato de eliminatoria)."}
          />
        )}
      </section>

      <MatchesSection id="calendario" title="Calendario" loaded={upcoming} emptyTitle="No hay partidos próximos" />
      <MatchesSection
        id="resultados"
        title="Resultados"
        loaded={results}
        emptyTitle="No hay resultados"
        pager={{ basePath: `/torneos/${id}`, page }}
      />
    </div>
  );
}
