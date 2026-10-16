import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchCard } from "@/components/MatchCard";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Pager } from "@/components/entity/Pager";
import { getArchivedLeagueMatches, getArchivedLeagues } from "@/lib/sources/result-archive";
import { safe } from "@/lib/services/safe";
import { parseId, parsePage } from "@/lib/params";
import type { Match } from "@/types/domain";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 24;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  if (id === null) return { title: "Archivo · LoL Hub" };
  const leagues = await safe(getArchivedLeagues);
  const league = leagues.data?.find((item) => item.league_id === id);
  return { title: `${league?.league_name ?? "Archivo"} · LoL Hub` };
}

export default async function ArchiveLeaguePage({ params, searchParams }: Props) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const page = parsePage((await searchParams).page);
  const [leagues, archived] = await Promise.all([
    safe(getArchivedLeagues),
    safe(() => getArchivedLeagueMatches(id, page)),
  ]);
  if (leagues.error) return <ErrorState message={leagues.error} />;
  const league = leagues.data?.find((item) => item.league_id === id);
  if (!league) notFound();

  return (
    <section aria-labelledby="archive-league-title" className="space-y-5">
      <Link href="/archivo" className="text-sm text-accent">← Archivo de resultados</Link>
      <h1 id="archive-league-title" className="text-2xl font-semibold">{league.league_name}</h1>
      {archived.error ? (
        <ErrorState message={archived.error} />
      ) : !archived.data || archived.data.items.length === 0 ? (
        <EmptyState title="No hay más resultados archivados" />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archived.data.items.map((match: Match) => (
              <li key={match.id}><MatchCard match={match} /></li>
            ))}
          </ul>
          <Pager
            basePath={`/archivo/${id}`}
            page={page}
            hasNext={archived.data.total === null
              ? archived.data.items.length === PAGE_SIZE
              : page * PAGE_SIZE < archived.data.total}
          />
        </>
      )}
    </section>
  );
}