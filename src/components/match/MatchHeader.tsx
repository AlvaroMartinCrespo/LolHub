import Link from "next/link";
import type { Match, MatchSide } from "@/types/domain";
import { LocalTime } from "../ui/LocalTime";
import { SafeImage } from "../ui/SafeImage";
import { StatusBadge } from "../ui/StatusBadge";

function Side({ side, won, showScore }: { side: MatchSide; won: boolean; showScore: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <SafeImage src={side.team.imageUrl} alt={`Logo de ${side.team.name}`} fallbackName={side.team.name} size={72} />
      <Link
        href={`/equipos/${side.team.id}`}
        className="font-semibold hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {side.team.name}
      </Link>
      {showScore && (
        <span
          className={`text-4xl font-bold tabular-nums ${won ? "text-accent" : ""}`}
          aria-label={`Marcador de la serie de ${side.team.name}: ${side.score ?? "sin datos"}`}
        >
          {side.score ?? "–"}
        </span>
      )}
    </div>
  );
}

export function MatchHeader({ match }: { match: Match }) {
  const showScore = match.status === "live" || match.status === "finished";
  return (
    <header className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>
          {match.league ? (
            <Link href={`/ligas/${match.league.id}`} className="hover:text-accent">{match.league.name}</Link>
          ) : (
            "Competición por confirmar"
          )}
          {match.serieName && <> · {match.serieName}</>}
        </span>
        <StatusBadge status={match.status} />
      </div>

      {match.sides ? (
        <div className="mt-5 flex items-start justify-center gap-4">
          <Side side={match.sides[0]} won={match.status === "finished" && match.winnerTeamId === match.sides[0].team.id} showScore={showScore} />
          <span aria-hidden className="pt-6 text-muted">vs</span>
          <Side side={match.sides[1]} won={match.status === "finished" && match.winnerTeamId === match.sides[1].team.id} showScore={showScore} />
        </div>
      ) : (
        <p className="mt-5 text-center text-muted">Rivales por determinar</p>
      )}
      {match.forfeit && <p className="mt-3 text-center text-sm text-amber-300">Resultado por incomparecencia</p>}

      <dl className="mt-5 grid gap-x-6 gap-y-2 border-t border-border pt-4 text-sm sm:grid-cols-2">
        <div className="flex gap-2"><dt className="text-muted">Inicio:</dt><dd><LocalTime iso={match.startTime} /></dd></div>
        {match.endTime && (
          <div className="flex gap-2"><dt className="text-muted">Fin:</dt><dd><LocalTime iso={match.endTime} /></dd></div>
        )}
        <div className="flex gap-2"><dt className="text-muted">Torneo / fase:</dt><dd>
          {match.tournamentName && match.tournamentId !== null ? (
            <Link href={`/torneos/${match.tournamentId}`} className="text-accent">{match.tournamentName}</Link>
          ) : (
            (match.tournamentName ?? "Sin datos")
          )}
        </dd></div>
        <div className="flex gap-2"><dt className="text-muted">Formato:</dt><dd>{match.bestOf !== null ? `Al mejor de ${match.bestOf}` : "Sin datos"}</dd></div>
      </dl>
    </header>
  );
}
