import Link from "next/link";
import type { Match } from "@/types/domain";
import { formatDuration } from "@/lib/format/text";
import { LocalTime } from "./ui/LocalTime";
import { StatusBadge } from "./ui/StatusBadge";
import { TeamBadge } from "./TeamBadge";

interface Props {
  match: Match;
  /** Si se indica, la tarjeta enlaza a la ficha del partido */
  href?: string;
}

export function MatchCard({ match, href }: Props) {
  const showScore = match.status === "live" || match.status === "finished";
  const teams = match.sides;
  const nameOf = (id: number | null) =>
    teams?.find((s) => s.team.id === id)?.team;

  const body = (
    <article
      aria-label={match.name}
      className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/60"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span className="truncate">
          {[match.league?.name, match.tournamentName].filter(Boolean).join(" · ") || "Competición por confirmar"}
        </span>
        <StatusBadge status={match.status} />
      </header>

      {teams ? (
        <ul className="mt-3 space-y-2">
          {teams.map((side) => {
            const won = match.status === "finished" && match.winnerTeamId === side.team.id;
            return (
              <li key={side.team.id} className="flex items-center justify-between gap-3">
                <TeamBadge team={side.team} />
                {showScore && (
                  <span
                    className={`min-w-6 text-right text-lg tabular-nums ${won ? "font-bold text-accent" : "text-fg"}`}
                    aria-label={`Marcador de ${side.team.name}: ${side.score ?? "sin datos"}`}
                  >
                    {side.score ?? "–"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-muted">Rivales por determinar</p>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <LocalTime iso={match.startTime} />
        {match.bestOf !== null && <span>Al mejor de {match.bestOf}</span>}
      </footer>

      {showScore && match.games.length > 0 && (
        <ol className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 text-xs text-muted" aria-label="Resultado por mapa">
          {match.games.map((g, i) => {
            const winner = nameOf(g.winnerTeamId);
            const dur = formatDuration(g.durationSeconds);
            return (
              <li key={g.id} className="rounded border border-border px-2 py-1">
                Mapa {g.position ?? i + 1}:{" "}
                {g.status === "finished" ? (winner ? (winner.acronym ?? winner.name) : "sin ganador") : g.status === "running" ? "en juego" : "pendiente"}
                {dur && <> · {dur}</>}
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );

  return href ? (
    <Link href={href} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
      {body}
    </Link>
  ) : (
    body
  );
}
