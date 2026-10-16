"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match } from "@/types/domain";
import { buildOptions, filterMatches, isFiltered, sortRecent } from "@/lib/filters/matches";
import { EMPTY_CRITERIA, type MatchCriteria, type Period } from "@/lib/filters/types";
import { MultiSelect } from "../filters/MultiSelect";
import { PeriodFilter } from "../filters/PeriodFilter";
import { EmptyState } from "../states/EmptyState";
import { ErrorState } from "../states/ErrorState";
import { MatchList } from "./MatchList";

interface Props {
  matches: Match[];
  error: string | null;
  query: string;
}

interface Local {
  leagueIds: string[];
  teamIds: string[];
  tournaments: string[];
  period: Period;
}
const INITIAL: Local = { leagueIds: [], teamIds: [], tournaments: [], period: "all" };

export function ResultsSection({ matches, error, query }: Props) {
  const router = useRouter();
  const [f, setF] = useState<Local>(INITIAL);
  const sorted = useMemo(() => sortRecent(matches), [matches]);
  const options = useMemo(() => buildOptions(matches), [matches]);
  const criteria: MatchCriteria = { ...EMPTY_CRITERIA, ...f, query };
  const visible = useMemo(() => filterMatches(sorted, criteria), [sorted, f, query]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-labelledby="resultados" className="space-y-4">
      <h2 id="resultados" className="text-xl font-semibold">Resultados recientes</h2>
      {error ? (
        <ErrorState message={error} onRetry={() => router.refresh()} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect label="Liga" options={options.leagues} selected={f.leagueIds} onChange={(leagueIds) => setF({ ...f, leagueIds })} />
            <MultiSelect label="Equipo" options={options.teams} selected={f.teamIds} onChange={(teamIds) => setF({ ...f, teamIds })} />
            <MultiSelect label="Torneo" options={options.tournaments} selected={f.tournaments} onChange={(tournaments) => setF({ ...f, tournaments })} />
            <PeriodFilter value={f.period} onChange={(period) => setF({ ...f, period })} />
            {isFiltered(criteria) && (
              <button type="button" onClick={() => setF(INITIAL)} className="min-h-10 px-2 text-sm text-accent">Restablecer filtros</button>
            )}
          </div>
          {matches.length === 0 ? (
            <EmptyState title="No hay resultados recientes" description="La fuente de datos no devolvió partidos finalizados." />
          ) : visible.length === 0 ? (
            <EmptyState
              title="Ningún resultado coincide con los filtros"
              action={<button type="button" onClick={() => setF(INITIAL)} className="min-h-10 rounded-md border border-border px-3 text-sm">Restablecer filtros</button>}
            />
          ) : (
            <MatchList matches={visible} />
          )}
        </>
      )}
    </section>
  );
}
