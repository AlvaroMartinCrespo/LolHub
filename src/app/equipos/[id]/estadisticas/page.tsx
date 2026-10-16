import { FreshnessNotice } from "@/components/states/FreshnessNotice";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeam, getTeamHistory } from "@/lib/services/lol";
import { loadEntity, safe } from "@/lib/services/safe";
import { parseId } from "@/lib/params";
import { applyStatsFilters, buildStatsOptions, parseStatsFilters } from "@/lib/stats/filters";
import { computeTeamStats } from "@/lib/stats/formulas";
import { computeRecords } from "@/lib/stats/records";
import { RecordsPanel } from "@/components/stats/RecordsPanel";
import { checkConsistency } from "@/lib/stats/validate";
import { PageError } from "@/components/entity/PageError";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { StatsFilterForm } from "@/components/stats/StatsFilterForm";
import { TeamStatsPanel } from "@/components/stats/TeamStatsPanel";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  if (id === null) return { title: "Estadísticas · LoL Hub" };
  const t = await safe(() => getTeam(id));
  return { title: `Estadísticas de ${t.data?.name ?? "equipo"} · LoL Hub` };
}

export default async function TeamStatsPage({ params, searchParams }: Props) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const filters = parseStatsFilters(await searchParams);

  const team = await loadEntity(() => getTeam(id));
  if (!team.data) return <PageError message={team.error ?? "Error inesperado."} />;
  const history = await safe(() => getTeamHistory(id));

  return (
    <div className="space-y-6">
      <FreshnessNotice />
      <nav aria-label="Migas de pan"><Link href={`/equipos/${id}`} className="text-sm text-accent">← {team.data.name}</Link></nav>
      <h1 className="text-2xl font-semibold">Estadísticas de {team.data.name}</h1>

      {history.error || !history.data ? (
        <ErrorState message={history.error ?? "No se pudo cargar el historial."} />
      ) : history.data.matches.length === 0 ? (
        <EmptyState title="Sin partidos para calcular estadísticas" />
      ) : (
        (() => {
          const all = history.data.matches;
          const filtered = applyStatsFilters(all, filters);
          const stats = computeTeamStats(filtered, id);
          const consistency = checkConsistency(filtered, stats);
          return (
            <>
              <StatsFilterForm action={`/equipos/${id}/estadisticas`} options={buildStatsOptions(all)} value={filters} />
              {stats.sample.series === 0 ? (
                <EmptyState title="Ninguna serie cumple los filtros" description="Prueba con otros filtros o restablécelos." />
              ) : (
                <>
                  <TeamStatsPanel stats={stats} consistency={consistency} truncated={history.data.truncated} />
                  <RecordsPanel records={computeRecords(filtered, id)} />
                </>
              )}
              <p className="text-sm text-muted">
                Estadísticas por jugador (rol, KDA…) no incluidas: requieren datos que la fuente verificada no proporciona.{" "}
                <Link href="/comparar" className="text-accent">Comparar con otro equipo</Link>
              </p>
            </>
          );
        })()
      )}
    </div>
  );
}
