import { FreshnessNotice } from "@/components/states/FreshnessNotice";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { byTeam, getPlayer, getRecentMatches } from "@/lib/services/lol";
import { loadEntity, safe } from "@/lib/services/safe";
import { parseId, parsePage } from "@/lib/params";
import { SafeImage } from "@/components/ui/SafeImage";
import { EmptyState } from "@/components/states/EmptyState";
import { MatchesSection } from "@/components/entity/MatchesSection";
import { PageError } from "@/components/entity/PageError";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  if (id === null) return { title: "Jugador no encontrado · LoL Hub" };
  const p = await safe(() => getPlayer(id));
  return { title: `${p.data?.name ?? "Jugador"} · LoL Hub` };
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const page = parsePage((await searchParams).page);

  const player = await loadEntity(() => getPlayer(id));
  if (!player.data) return <PageError message={player.error ?? "Error inesperado."} />;
  const p = player.data;

  const recent = p.team
    ? await safe(() => getRecentMatches({ perPage: 12, page, filters: byTeam(p.team!.id) }))
    : null;

  return (
    <div className="space-y-10">
      <FreshnessNotice />
      <nav aria-label="Migas de pan"><Link href="/" className="text-sm text-accent">← Inicio</Link></nav>
      <header className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
        <SafeImage src={p.imageUrl} alt={`Foto de ${p.name}`} fallbackName={p.name} size={80} rounded="full" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          {p.fullName && <p className="text-muted">{p.fullName}</p>}
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <div className="flex gap-1"><dt className="text-muted">Equipo:</dt>
              <dd>{p.team ? <Link href={`/equipos/${p.team.id}`} className="text-accent">{p.team.name}</Link> : "Sin equipo"}</dd></div>
            <div className="flex gap-1"><dt className="text-muted">Rol:</dt><dd>{p.role ?? "Sin datos"}</dd></div>
            <div className="flex gap-1"><dt className="text-muted">Región/país:</dt><dd>{p.nationality ?? "Sin datos"}</dd></div>
            {p.active !== null && <div className="flex gap-1"><dt className="text-muted">Estado:</dt><dd>{p.active ? "Activo" : "Inactivo"}</dd></div>}
          </dl>
        </div>
      </header>

      <section aria-labelledby="historial" className="space-y-2">
        <h2 id="historial" className="text-xl font-semibold">Historial</h2>
        <EmptyState
          title="Historial de equipos no disponible"
          description="La fuente de datos verificada solo informa del equipo actual del jugador."
        />
      </section>

      {recent ? (
        <MatchesSection
          id="resultados"
          title="Partidos recientes de su equipo"
          note="Resultados del equipo actual del jugador; la fuente no indica en cuáles participó."
          loaded={recent}
          emptyTitle="No hay resultados"
          pager={{ basePath: `/jugadores/${id}`, page }}
        />
      ) : (
        <EmptyState title="Sin equipo actual" description="No se pueden mostrar partidos sin un equipo asociado." />
      )}
    </div>
  );
}
