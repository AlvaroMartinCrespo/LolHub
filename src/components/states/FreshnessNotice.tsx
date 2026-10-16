import { getSourceFreshness, getStaleSince } from "@/lib/services/freshness";
import { getSource } from "@/lib/sources/catalog";
import { StaleNotice } from "./StaleNotice";

/**
 * Muestra el aviso «desactualizado» si en esta petición se sirvieron datos de reserva.
 * Debe renderizarse dentro de la página, después de que ésta haya cargado sus datos.
 */
export function FreshnessNotice() {
  const sources = getSourceFreshness();
  const staleSince = getStaleSince();
  if (sources.length === 0 && !staleSince) return null;

  const sourceLabel = sources.map(({ source }) => getSource(source).name).join(", ");
  const lastUpdatedIso = sources.map(({ fetchedAt }) => fetchedAt).sort()[0] ?? staleSince;
  return <StaleNotice lastUpdatedIso={staleSince ?? lastUpdatedIso} sourceLabel={sourceLabel} isStale={Boolean(staleSince)} />;
}
