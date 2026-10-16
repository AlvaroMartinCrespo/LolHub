import { FreshnessNotice } from "@/components/states/FreshnessNotice";
import type { Metadata } from "next";
import Link from "next/link";
import { getLeagues } from "@/lib/services/lol";
import { safe } from "@/lib/services/safe";
import { parsePage } from "@/lib/params";
import { SafeImage } from "@/components/ui/SafeImage";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Pager } from "@/components/entity/Pager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Competiciones · LoL Hub" };

const PER_PAGE = 48;

export default async function Competitions({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const page = parsePage((await searchParams).page);
  const leagues = await safe(() => getLeagues({ perPage: PER_PAGE, page }));

  return (
    <section aria-labelledby="ligas" className="space-y-4">
      <FreshnessNotice />
      <h1 id="ligas" className="text-2xl font-semibold">Ligas y torneos</h1>
      {leagues.error ? (
        <ErrorState message={leagues.error} />
      ) : !leagues.data || leagues.data.items.length === 0 ? (
        <EmptyState title="No hay ligas disponibles" />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leagues.data.items.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/ligas/${l.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <SafeImage src={l.imageUrl} alt={`Logo de ${l.name}`} fallbackName={l.name} size={40} />
                  <span className="truncate font-medium">{l.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Pager basePath="/competiciones" page={page} hasNext={leagues.data.items.length + leagues.data.skipped >= PER_PAGE} />
        </>
      )}
    </section>
  );
}
