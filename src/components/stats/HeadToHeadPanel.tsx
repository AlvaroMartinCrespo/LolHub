import type { Team } from "@/types/domain";
import type { HeadToHead } from "@/lib/stats/headToHead";
import { MatchCard } from "../MatchCard";
import { EmptyState } from "../states/EmptyState";

export function HeadToHeadPanel({ a, b, h2h }: { a: Team; b: Team; h2h: HeadToHead }) {
  return (
    <section aria-labelledby="h2h" className="space-y-3">
      <h2 id="h2h" className="text-xl font-semibold">Enfrentamientos directos</h2>
      {h2h.matches.length === 0 ? (
        <EmptyState title="Sin enfrentamientos en la muestra" description="No hay series finalizadas entre ambos equipos en los partidos cargados." />
      ) : (
        <>
          <p className="text-sm">
            <strong>{a.name}</strong> {h2h.aWins}–{h2h.bWins} <strong>{b.name}</strong> en series
            {" "}· mapas {h2h.mapsA}–{h2h.mapsB}
            {h2h.notCounted > 0 && <> · {h2h.notCounted} sin ganador o por incomparecencia (no cuentan)</>}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {h2h.matches.slice(0, 12).map((m) => (
              <li key={m.id}><MatchCard match={m} href={`/partidos/${m.id}`} /></li>
            ))}
          </ul>
          {h2h.matches.length > 12 && <p className="text-sm text-muted">Mostrando los 12 más recientes de {h2h.matches.length}.</p>}
          <p className="text-sm text-muted">Basado en los últimos 300 partidos de cada equipo y los filtros activos; puede haber enfrentamientos anteriores.</p>
        </>
      )}
    </section>
  );
}
