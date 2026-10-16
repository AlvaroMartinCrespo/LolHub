import "server-only";
import type { SourceId } from "../catalog";
import { createCitoApiAdapter } from "./citoapi";
import { createLeaguepediaAdapter } from "./leaguepedia";
import { oraclesElixirAdapter } from "./oracleselixir";
import { pandaScoreAdapter } from "./pandascore";
import type { SourceAdapter } from "./base";

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

export { pandaScoreAdapter, createCitoApiAdapter, createLeaguepediaAdapter, oraclesElixirAdapter };
