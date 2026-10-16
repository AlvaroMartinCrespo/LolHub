import type { Metadata } from "next";
import Link from "next/link";
import type { League } from "@/types/domain";
import { INTL_QUERIES, classifyInternationals, type IntlKind } from "@/lib/internationals";
import { byLeague, getRecentMatches, getTournaments, getUpcomingMatches, searchLeagues } from "@/lib/services/lol";
import { safe } from "@/lib/services/safe";
import { LocalTime } from "@/components/ui/LocalTime";
import { SafeImage } from "@/components/ui/SafeImage";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { FreshnessNotice } from "@/components/states/FreshnessNotice";
import { MatchesSection } from "@/components/entity/MatchesSection";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Worlds y MSI · LoL Hub" };

const TITLES: Record<IntlKind, string> = { worlds: "Mundial (Worlds)", msi: "Mid-Season Invitational (MSI)" };

async function Group({ kind, leagues }: { kind: IntlKind; leagues: League[] }) {
  const main = leagues[0];
  const [tournaments, upcoming, results] = await Promise.all([
    safe(() => getTournaments({ perPage: 4, filters: { "filter[league_id]": main.id } })),
    safe(() => getUpcomingMatches({ perPage: 6, filters: byLeague(main.id) })),
    safe(() => getRecentMatches({ perPage: 6, filters: byLeague(main.id) })),
  ]);
  return (
    <section aria-labelledby={`g-${kind}`} className="space-y-4">
      <h2 id={`g-${kind}`} className="text-2xl font-semibold">{TITLES[kind]}</h2>
      <Link href={`/ligas/${main.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:border-accent/60">
        <SafeImage src={main.imageUrl} alt={`Logo de ${main.name}`} fallbackName={main.name} size={48} />
        <span className="font-medium">{main.name}</span>
        <span className="ml-auto text-sm text-accent">Ver liga completa →</span>
      </Link>
      {leagues.length > 1 && (
        <p className="text-sm text-muted">
          Otras ligas con nombre similar:{" "}
          {leagues.slice(1).map((l, i) => (
            <span key={l.id}>{i > 0 && ", "}<Link href={`/ligas/${l.id}`} className="text-accent">{l.name}</Link></span>
          ))}
        </p>
      )}
      {tournaments.data && tournaments.data.items.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {tournaments.data.items.map((t) => (
            <li key={t.id}>
              <Link href={`/torneos/${t.id}`} className="inline-flex gap-2 rounded-md border border-border bg-surface px-3 py-2 hover:border-accent/60">
                {t.name} <span className="text-muted"><LocalTime iso={t.startsAt} fallback="" /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <MatchesSection id={`${kind}-prox`} title="Próximos partidos" loaded={upcoming} emptyTitle="No hay partidos próximos" />
      <MatchesSection id={`${kind}-res`} title="Resultados recientes" loaded={results} emptyTitle="No hay resultados" />
    </section>
  );
}

export default async function Internationals() {
  const searches = await Promise.all(
    Object.values(INTL_QUERIES).flat().map((q) => safe(() => searchLeagues(q, 10))),
  );
  const found = searches.flatMap((s) => s.data?.items ?? []);
  const error = searches.every((s) => s.error) ? searches[0].error : null;
  const groups = classifyInternationals(found);

  return (
    <div className="space-y-10">
      <FreshnessNotice />
      <h1 className="text-2xl font-semibold">Worlds y MSI</h1>
      {error ? (
        <ErrorState message={error} />
      ) : (
        (Object.keys(groups) as IntlKind[]).map((k) =>
          groups[k].length > 0 ? (
            <Group key={k} kind={k} leagues={groups[k]} />
          ) : (
            <section key={k} className="space-y-2">
              <h2 className="text-2xl font-semibold">{TITLES[k]}</h2>
              <EmptyState title="No se encontró en la fuente de datos" description="La búsqueda por nombre no devolvió ninguna liga. Puedes buscarla manualmente en Competiciones." />
            </section>
          ),
        )
      )}
    </div>
  );
}
