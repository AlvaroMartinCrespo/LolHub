import { getStaleSince } from "@/lib/services/freshness";
import { StaleNotice } from "./StaleNotice";

/**
 * Muestra el aviso «desactualizado» si en esta petición se sirvieron datos de reserva.
 * Debe renderizarse dentro de la página, después de que ésta haya cargado sus datos.
 */
export function FreshnessNotice() {
  const since = getStaleSince();
  return since ? <StaleNotice lastUpdatedIso={since} /> : null;
}
