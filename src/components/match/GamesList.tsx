import type { Match } from "@/types/domain";
import { formatDuration } from "@/lib/format/text";
import { EmptyState } from "../states/EmptyState";
import { LocalTime } from "../ui/LocalTime";

const GAME_STATUS = { not_started: "Pendiente", running: "En juego", finished: "Finalizado", unknown: "Sin datos" } as const;

/** Resultado de cada mapa, separado del marcador de la serie. */
export function GamesList({ match }: { match: Match }) {
  return (
    <section aria-labelledby="mapas" className="space-y-3">
      <h2 id="mapas" className="text-xl font-semibold">Resultado por mapa</h2>
      {match.games.length === 0 ? (
        <EmptyState title="Sin información de mapas" description="La fuente de datos no proporciona mapas para este partido." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Mapas de la serie</caption>
            <thead className="bg-surface text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Mapa</th>
                <th scope="col" className="px-3 py-2">Estado</th>
                <th scope="col" className="px-3 py-2">Ganador</th>
                <th scope="col" className="px-3 py-2">Duración</th>
                <th scope="col" className="px-3 py-2">Inicio</th>
              </tr>
            </thead>
            <tbody>
              {match.games.map((g, i) => {
                const winner = match.sides?.find((s) => s.team.id === g.winnerTeamId)?.team;
                return (
                  <tr key={g.id} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 font-medium">Mapa {g.position ?? i + 1}</th>
                    <td className="px-3 py-2">{GAME_STATUS[g.status]}{g.forfeit && " (incomparecencia)"}</td>
                    <td className="px-3 py-2">{g.status === "finished" ? (winner?.name ?? "Sin datos") : "–"}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDuration(g.durationSeconds) ?? "–"}</td>
                    <td className="px-3 py-2"><LocalTime iso={g.startedAt} fallback="–" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
