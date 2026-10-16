/**
 * Modelo interno para datos que vienen de fuentes distintas de PandaScore (Paso 12.3.1).
 * Los adaptadores devuelven estos tipos (o los de `domain.ts` cuando encajan); la UI nunca ve el formato del proveedor.
 * Los IDs externos son siempre `string`: cada proveedor usa su propio formato (UUID, slug, nombre de página…).
 */
import type { SourceId } from "@/lib/sources/catalog";

export type EntityKind = "team" | "player" | "tournament" | "league";

/** Procedencia de un dato: de qué fuente viene y cuándo se obtuvo (ISO 8601 UTC). */
export interface SourceMeta {
  source: SourceId;
  fetchedAt: string;
}

/** Referencia a una entidad en una fuente concreta. */
export interface EntityRef {
  source: SourceId;
  kind: EntityKind;
  externalId: string;
}

/** Lo mínimo que hace falta para reconciliar una entidad entre fuentes. */
export interface EntityIdentity extends EntityRef {
  name: string;
  acronym: string | null;
  /** Región o país tal como lo informa la fuente (sin normalizar). */
  region: string | null;
}

/** Equipo de una fuente externa (Leaguepedia, CitoAPI, Oracle's Elixir). */
export interface ExternalTeam {
  meta: SourceMeta;
  externalId: string;
  name: string;
  acronym: string | null;
  region: string | null;
  location: string | null;
  disbanded: boolean | null;
  /** Nombre de archivo del logo en la fuente. NO es una URL: los logos pertenecen a cada equipo y su uso requiere permiso. */
  logoFile: string | null;
}

/** Paso de un jugador (o miembro de plantilla) por un equipo. */
export interface TeamStint {
  meta: SourceMeta;
  playerExternalId: string | null;
  playerName: string;
  teamExternalId: string;
  teamName: string;
  role: string | null;
  /** ISO 8601 UTC o null si la fuente no lo informa. */
  startedAt: string | null;
  endedAt: string | null;
  /** true si es el equipo actual según la fuente. */
  current: boolean | null;
}

export type Side = "blue" | "red";

/** Resultado de un mapa en una fuente con IDs propios. */
export interface ExternalGameResult {
  externalId: string;
  winnerSide: 1 | 2 | null;
}

/** Serie (partido al mejor de N) tal como la informa una fuente externa. */
export interface ExternalSeries {
  meta: SourceMeta;
  externalId: string;
  bestOf: number | null;
  scoreTeam1: number | null;
  scoreTeam2: number | null;
  games: ExternalGameResult[];
}

/** Estadísticas de un jugador en un mapa. Todos los números son nulos si la columna no existe o está vacía. */
export interface PlayerGameStat {
  participantId: number;
  side: Side;
  position: string | null;
  playerExternalId: string | null;
  playerName: string | null;
  teamExternalId: string | null;
  teamName: string | null;
  champion: string | null;
  won: boolean | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  totalGold: number | null;
  damageToChampions: number | null;
  minionKills: number | null;
  monsterKills: number | null;
  wardsPlaced: number | null;
}

/** Un mapa de una partida profesional con sus estadísticas (una fila de Oracle's Elixir por jugador/equipo, agrupadas). */
export interface StatGame {
  meta: SourceMeta;
  externalId: string;
  league: string | null;
  year: number | null;
  split: string | null;
  playoffs: boolean | null;
  /** Fecha del mapa tal como la publica la fuente (YYYY-MM-DD). No se convierte a instante: la fuente no documenta la zona horaria. */
  playedOn: string | null;
  /** Número de mapa dentro de la serie. */
  gameNumber: number | null;
  patch: string | null;
  /** true si la fuente marca la fila como completa; false si es parcial; null si no informa. */
  dataComplete: boolean | null;
  blueTeam: { externalId: string | null; name: string | null };
  redTeam: { externalId: string | null; name: string | null };
  winnerSide: Side | null;
  durationSeconds: number | null;
  players: PlayerGameStat[];
}
