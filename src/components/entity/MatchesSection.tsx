import type { Match, Page } from "@/types/domain";
import { MatchCard } from "../MatchCard";
import { EmptyState } from "../states/EmptyState";
import { ErrorState } from "../states/ErrorState";
import { Pager } from "./Pager";

interface Props {
  id: string;
  title: string;
  loaded: { data: Page<Match> | null; error: string | null };
  emptyTitle: string;
  note?: string;
  /** Si se indica, muestra paginación por ?page= */
  pager?: { basePath: string; page: number };
}

export function MatchesSection({ id, title, loaded, emptyTitle, note, pager }: Props) {
  return (
    <section aria-labelledby={`${id}-t`} id={id} className="space-y-3 scroll-mt-4">
      <h2 id={`${id}-t`} className="text-xl font-semibold">{title}</h2>
      {note && <p className="text-sm text-muted">{note}</p>}
      {loaded.error ? (
        <ErrorState message={loaded.error} />
      ) : !loaded.data || loaded.data.items.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loaded.data.items.map((m) => (
              <li key={m.id}><MatchCard match={m} href={`/partidos/${m.id}`} /></li>
            ))}
          </ul>
          {pager && (
            <Pager
              basePath={pager.basePath}
              page={pager.page}
              hasNext={loaded.data.items.length + loaded.data.skipped >= loaded.data.perPage}
              anchor={id}
            />
          )}
        </>
      )}
    </section>
  );
}
