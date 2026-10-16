import { FreshnessNotice } from "@/components/states/FreshnessNotice";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecentMatches, getTeam, getUpcomingMatches, byTeam } from "@/lib/services/lol";
import { loadEntity, safe } from "@/lib/services/safe";
import { parseId, parsePage } from "@/lib/params";
import { SafeImage } from "@/components/ui/SafeImage";
import { PlayerCard } from "@/components/PlayerCard";
import { EmptyState } from "@/components/states/EmptyState";
import { FavoriteTeamButton } from "@/components/favorites/FavoriteTeamButton";
import { MatchesSection } from "@/components/entity/MatchesSection";
import { PageError } from "@/components/entity/PageError";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  if (id === null) return { title: "Equipo no encontrado · LoL Hub" };
  const t = await safe(() => getTeam(id));
  return { title: `${t.data?.name ?? "Equipo"} · LoL Hub` };
}

export default async function TeamPage({ params, searchParams }: Props) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const page = parsePage((await searchParams).page);

  const team = await loadEntity(() => getTeam(id));
  if (!team.data) return <PageError message={team.error ?? "Error inesperado."} />;
  const t = team.data;

  const [upcoming, results] = await Promise.all([
    safe(() => getUpcomingMatches({ perPage: 12, filters: byTeam(id) })),
    safe(() => getRecentMatches({ perPage: 12, page, filters: byTeam(id) })),
  ]);

  return (
    <div className="space-y-10">
      <FreshnessNotice />
      <nav aria-label="Migas de pan"><Link href="/" className="text-sm text-accent">← Inicio</Link></nav>
      <header className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
        <SafeImage src={t.imageUrl} alt={`Logo de ${t.name}`} fallbackName={t.name} size={80} />
        <div>
          <h1 className="text-2xl font-semibold">{t.name}</h1>
          <p className="text-muted">
            {[t.acronym, t.region].filter(Boolean).join(" · ") || "Sin datos adicionales"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <FavoriteTeamButton id={t.id} name={t.name} />
            <Link href={`/equipos/${id}/estadisticas`} className="text-sm text-accent">Ver estadísticas →</Link>
          </div>
        </div>
      </header>

      <section aria-labelledby="plantilla" className="space-y-3">
        <h2 id="plantilla" className="text-xl font-semibold">Plantilla</h2>
        {t.roster.length === 0 ? (
          <EmptyState title="Sin jugadores disponibles" description="La fuente de datos no devolvió plantilla." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {t.roster.map((p) => (
              <li key={p.id}><PlayerCard player={p} href={`/jugadores/${p.id}`} /></li>
            ))}
          </ul>
        )}
      </section>

      <MatchesSection id="proximos" title="Próximos partidos" loaded={upcoming} emptyTitle="No hay partidos próximos" />
      <MatchesSection
        id="resultados"
        title="Resultados e historial"
        loaded={results}
        emptyTitle="No hay resultados"
        pager={{ basePath: `/equipos/${id}`, page }}
      />
    </div>
  );
}
