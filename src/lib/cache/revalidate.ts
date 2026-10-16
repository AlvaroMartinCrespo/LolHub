/**
 * Segundos de revalidación por tipo de dato (caché de datos de Next.js, compartida entre peticiones).
 * - running: muy frecuente (si el plan de PandaScore permite datos en directo)
 * - upcoming: frecuente
 * - finished / catalog: medio plazo
 * - historical: largo plazo (resultados antiguos, base de estadísticas)
 * - health: sin caché (comprobaciones de estado)
 */
export const REVALIDATE = {
  upcoming: 300,
  running: 30,
  finished: 3600,
  historical: 86400,
  health: 0,
  catalog: 3600,
  /** Ficha de partido: puede estar en directo, caché corta */
  detail: 60,
} as const;
export type RevalidateKind = keyof typeof REVALIDATE;
