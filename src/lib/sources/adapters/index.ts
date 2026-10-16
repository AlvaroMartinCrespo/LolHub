import "server-only";
import { DataSourceError } from "@/lib/services/errors";
import type { SourceId } from "../catalog";
import { canQuery, routeFor, type DataKind, type Route } from "../routing";
import { createCitoApiAdapter } from "./citoapi";
import { createLeaguepediaAdapter } from "./leaguepedia";
import { oraclesElixirAdapter } from "./oracleselixir";
import { pandaScoreAdapter } from "./pandascore";
import type { QueryContext, SourceAdapter } from "./base";

/**
 * Adaptadores disponibles hoy. Data Dragon (recursos estáticos, 12.2) y la API de Riot (futura) no tienen adaptador todavía:
 * el primero se consume como URL de CDN y el segundo está desactivado en el reparto de responsabilidades.
 */
export type AdaptedSourceId = Extract<SourceId, "pandascore" | "citoapi" | "leaguepedia" | "oracleselixir">;

export const getAdapters = (): Record<AdaptedSourceId, SourceAdapter> => ({
  pandascore: pandaScoreAdapter,
  citoapi: createCitoApiAdapter(),
  leaguepedia: createLeaguepediaAdapter(),
  oracleselixir: oraclesElixirAdapter,
});

export interface SourceResolution {
  route: Route;
  adapter: SourceAdapter | null;
}

/** Resuelve una ruta central y aplica sus restricciones antes de entregar un adaptador. */
export function resolveSource(kind: DataKind, ctx: QueryContext): SourceResolution {
  const route = routeFor(kind);
  const verdict = canQuery(kind, ctx);
  if (!verdict.ok) throw new DataSourceError("blocked", verdict.reason);

  const adapter = getAdapters()[route.source as AdaptedSourceId] ?? null;
  if (adapter && (adapter.id !== route.source || !adapter.kinds.includes(kind))) {
    throw new DataSourceError("invalid", `Adaptador incompatible con la ruta de ${kind}`);
  }
  return { route, adapter };
}

export { pandaScoreAdapter, createCitoApiAdapter, createLeaguepediaAdapter, oraclesElixirAdapter };
