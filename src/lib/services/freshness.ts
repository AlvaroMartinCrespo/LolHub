import "server-only";
import { cache } from "react";

/** Estado por petición: marca de tiempo más antigua entre los datos servidos «de reserva». */
const requestState = cache(() => ({ staleSince: null as number | null }));

export function markStale(fetchedAtMs: number): void {
  const s = requestState();
  s.staleSince = s.staleSince === null ? fetchedAtMs : Math.min(s.staleSince, fetchedAtMs);
}

/** ISO de la última actualización válida si algún dato de esta petición está desactualizado. */
export function getStaleSince(): string | null {
  const v = requestState().staleSince;
  return v === null ? null : new Date(v).toISOString();
}
