"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match } from "@/types/domain";
import { buildOptions, filterMatches, isFiltered, sortUpcoming } from "@/lib/filters/matches";
import { EMPTY_CRITERIA, EMPTY_DATE, type MatchCriteria } from "@/lib/filters/types";
import { MultiSelect } from "../filters/MultiSelect";
import { DateFilter } from "../filters/DateFilter";
import { EmptyState } from "../states/EmptyState";
import { ErrorState } from "../states/ErrorState";
import { MatchList } from "./MatchList";

interface Props {
  matches: Match[];
  error: string | null;
  query: string;
}

export function UpcomingSection({ matches, error, query }: Props) {
  const router = useRouter();
  const [f, setF] = useState<Pick<MatchCriteria, "leagueIds" | "regions" | "date">>({
    leagueIds: [], regions: [], date: EMPTY_DATE,
  });
  const sorted = useMemo(() => sortUpcoming(matches), [matches]);
  const options = useMemo(() => buildOptions(matches), [matches]);
  const criteria: MatchCriteria = { ...EMPTY_CRITERIA, ...f, query };
  const visible = useMemo(() => filterMatches(sorted, criteria), [sorted, f, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => setF({ leagueIds: [], regions: [], date: EMPTY_DATE });

  return (
    <section aria-labelledby="proximos" className="space-y-4">
      <h2 id="proximos" className="text-xl font-semibold">Próximos partidos</h2>
      {error ? (
        <ErrorState message={error} onRetry={() => router.refresh()} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect label="Liga" options={options.leagues} selected={f.leagueIds} onChange={(leagueIds) => setF({ ...f, leagueIds })} />
            <MultiSelect label="Región" options={options.regions} selected={f.regions} onChange={(regions) => setF({ ...f, regions })} />
            <DateFilter value={f.date} onChange={(date) => setF({ ...f, date })} />
            {isFiltered(criteria) && (
              <button type="button" onClick={reset} className="min-h-10 px-2 text-sm text-accent">Restablecer filtros</button>
            )}
          </div>
          {matches.length === 0 ? (
            <EmptyState title="No hay partidos próximos" description="La fuente de datos no devolvió partidos programados." />
          ) : visible.length === 0 ? (
            <EmptyState
              title="Ningún partido coincide con los filtros"
              action={<button type="button" onClick={reset} className="min-h-10 rounded-md border border-border px-3 text-sm">Restablecer filtros</button>}
            />
          ) : (
            <MatchList matches={visible} />
          )}
        </>
      )}
    </section>
  );
}
