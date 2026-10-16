import "server-only";
import { cache } from "react";
import type { SourceId } from "@/lib/sources/catalog";

/** Estado por petición: marca de tiempo más antigua entre los datos servidos «de reserva». */
const requestState = cache(() => ({ staleSince: null as number | null, sources: new Map<SourceId, number>() }));

export function markFetched(source: SourceId, fetchedAtMs: number): void {
  const sources = requestState().sources;
  const previous = sources.get(source);
  sources.set(source, previous === undefined ? fetchedAtMs : Math.min(previous, fetchedAtMs));
}

export function markStale(fetchedAtMs: number): void {
  const s = requestState();
  s.staleSince = s.staleSince === null ? fetchedAtMs : Math.min(s.staleSince, fetchedAtMs);
  markFetched("pandascore", fetchedAtMs);
}

/** ISO de la última actualización válida si algún dato de esta petición está desactualizado. */
export function getStaleSince(): string | null {
  const v = requestState().staleSince;
  return v === null ? null : new Date(v).toISOString();
}

export function getSourceFreshness(): { source: SourceId; fetchedAt: string }[] {
  return [...requestState().sources].map(([source, timestamp]) => ({ source, fetchedAt: new Date(timestamp).toISOString() }));
}
