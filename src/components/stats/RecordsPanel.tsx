import Link from "next/link";
import type { TeamRecords } from "@/lib/stats/records";
import { formatDuration } from "@/lib/format/text";
import { StatCard } from "./parts";

export function RecordsPanel({ records }: { records: TeamRecords }) {
  const g = (r: TeamRecords["longestGame"]) =>
    r ? (
      <Link href={`/partidos/${r.matchId}`} className="text-accent">ver partido</Link>
    ) : null;
  return (
    <section aria-labelledby="records" className="space-y-3">
      <h2 id="records" className="text-xl font-semibold">Récords</h2>
      <p className="text-sm text-muted">
        Calculados sobre las {records.series} series de la muestra filtrada. Filtra por temporada para obtener los récords de una temporada.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Mayor racha de victorias" value={String(records.longestWinStreak)} detail="series consecutivas" />
        <StatCard label="Mayor racha de derrotas" value={String(records.longestLossStreak)} detail="series consecutivas" />
        <StatCard label="Mayor victoria" value={records.biggestWin ? records.biggestWin.score : "–"} detail={records.biggestWin ? `diferencia de ${records.biggestWin.margin} mapas` : "sin marcadores disponibles"} />
        <StatCard label="Partida más larga" value={records.longestGame ? (formatDuration(records.longestGame.seconds) ?? "–") : "–"} detail={records.longestGame ? undefined : "sin duraciones disponibles"} />
        <StatCard label="Partida más corta" value={records.shortestGame ? (formatDuration(records.shortestGame.seconds) ?? "–") : "–"} detail={records.shortestGame ? undefined : "sin duraciones disponibles"} />
      </div>
      <p className="text-sm">
        {g(records.longestGame) && <>Más larga: {g(records.longestGame)}. </>}
        {g(records.shortestGame) && <>Más corta: {g(records.shortestGame)}.</>}
      </p>
    </section>
  );
}
