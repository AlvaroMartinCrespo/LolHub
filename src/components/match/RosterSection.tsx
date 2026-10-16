import Link from "next/link";
import type { Team } from "@/types/domain";
import { PlayerCard } from "../PlayerCard";
import { EmptyState } from "../states/EmptyState";

export interface TeamRoster {
  teamId: number;
  teamName: string;
  /** null si no se pudo cargar */
  team: Team | null;
}

/**
 * Plantilla actual de cada equipo. La API usada no proporciona (o no se ha verificado) la
 * alineación exacta de este partido, por eso se indica explícitamente.
 */
export function RosterSection({ rosters }: { rosters: TeamRoster[] }) {
  return (
    <section aria-labelledby="plantillas" className="space-y-3">
      <h2 id="plantillas" className="text-xl font-semibold">Plantillas</h2>
      <p className="text-sm text-muted">
        Plantilla actual de cada equipo; no es necesariamente la alineación que jugó este partido.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {rosters.map((r) => (
          <div key={r.teamId} className="space-y-2">
            <h3 className="font-semibold">
              <Link href={`/equipos/${r.teamId}`} className="hover:text-accent">{r.teamName}</Link>
            </h3>
            {r.team === null ? (
              <EmptyState title="No se pudo cargar la plantilla" />
            ) : r.team.roster.length === 0 ? (
              <EmptyState title="Sin jugadores disponibles" description="La fuente de datos no devolvió plantilla." />
            ) : (
              <ul className="space-y-2">
                {r.team.roster.map((p) => (
                  <li key={p.id}><PlayerCard player={p} href={`/jugadores/${p.id}`} /></li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
