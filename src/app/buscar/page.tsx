import type { Metadata } from "next";
import Link from "next/link";
import { searchLeagues, searchPlayers, searchTeams } from "@/lib/services/lol";
import { safe } from "@/lib/services/safe";
import { SafeImage } from "@/components/ui/SafeImage";
import { TeamCard } from "@/components/TeamCard";
import { PlayerCard } from "@/components/PlayerCard";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { FreshnessNotice } from "@/components/states/FreshnessNotice";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buscar · LoL Hub" };

function Block({ id, title, error, empty, children }: { id: string; title: string; error: string | null; empty: boolean; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-xl font-semibold">{title}</h2>
      {error ? <ErrorState message={error} /> : empty ? <EmptyState title="Sin resultados" /> : children}
    </section>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 60);

  const [teams, players, leagues] =
    q.length >= 2
      ? await Promise.all([safe(() => searchTeams(q)), safe(() => searchPlayers(q)), safe(() => searchLeagues(q))])
      : [null, null, null];

  return (
    <div className="space-y-8">
      <FreshnessNotice />
      <h1 className="text-2xl font-semibold">Buscar</h1>
      <form method="get" action="/buscar" role="search" className="flex gap-2">
        <label className="sr-only" htmlFor="q">Buscar equipos, jugadores o ligas</label>
        <input id="q" name="q" type="search" defaultValue={q} maxLength={60} placeholder="Equipo, jugador o liga…"
          className="min-h-10 w-full max-w-md rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
        <button type="submit" className="min-h-10 rounded-md bg-accent px-4 text-sm font-semibold text-bg">Buscar</button>
      </form>

      {!teams || !players || !leagues ? (
        <EmptyState title="Escribe al menos 2 caracteres" description="Se buscará en equipos, jugadores y ligas." />
      ) : (
        <>
          <Block id="r-equipos" title="Equipos" error={teams.error} empty={!teams.data?.items.length}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.data?.items.map((t) => <li key={t.id}><TeamCard team={t} href={`/equipos/${t.id}`} /></li>)}
            </ul>
          </Block>
          <Block id="r-jugadores" title="Jugadores" error={players.error} empty={!players.data?.items.length}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.data?.items.map((p) => <li key={p.id}><PlayerCard player={p} href={`/jugadores/${p.id}`} /></li>)}
            </ul>
          </Block>
          <Block id="r-ligas" title="Ligas" error={leagues.error} empty={!leagues.data?.items.length}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {leagues.data?.items.map((l) => (
                <li key={l.id}>
                  <Link href={`/ligas/${l.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:border-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                    <SafeImage src={l.imageUrl} alt={`Logo de ${l.name}`} fallbackName={l.name} size={40} />
                    <span className="truncate font-medium">{l.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Block>
        </>
      )}
    </div>
  );
}
