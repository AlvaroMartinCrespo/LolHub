"use client";

import { useMemo, useState } from "react";
import type { Match } from "@/types/domain";
import { buildOptions, filterMatches, sortUpcoming } from "@/lib/filters/matches";
import { EMPTY_CRITERIA } from "@/lib/filters/types";
import { MultiSelect } from "../filters/MultiSelect";
import { MatchCard } from "../MatchCard";
import { EmptyState } from "../states/EmptyState";

/** Partidos del día elegido, recortados a ese día en la zona horaria del navegador. */
export function DayView({ matches, day }: { matches: Match[]; day: string }) {
  const [leagueIds, setLeagueIds] = useState<string[]>([]);
  const ofDay = useMemo(
    () => sortUpcoming(filterMatches(matches, { ...EMPTY_CRITERIA, date: { preset: "date", date: day } })).sort(
      (a, b) => new Date(a.startTime ?? 0).getTime() - new Date(b.startTime ?? 0).getTime(),
    ),
    [matches, day],
  );
  const options = useMemo(() => buildOptions(ofDay).leagues, [ofDay]);
  const visible = useMemo(
    () => (leagueIds.length ? ofDay.filter((m) => m.league && leagueIds.includes(String(m.league.id))) : ofDay),
    [ofDay, leagueIds],
  );

  if (ofDay.length === 0) {
    return <EmptyState title="No hay partidos este día" description="La fuente de datos no devolvió partidos para la fecha elegida." />;
  }
  return (
    <div className="space-y-3">
      <MultiSelect label="Liga" options={options} selected={leagueIds} onChange={setLeagueIds} />
      <p className="text-sm text-muted" aria-live="polite">{visible.length} {visible.length === 1 ? "partido" : "partidos"}</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m) => (
          <li key={m.id}><MatchCard match={m} href={`/partidos/${m.id}`} /></li>
        ))}
      </ul>
    </div>
  );
}
