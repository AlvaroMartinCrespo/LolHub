/** Modelo interno, independiente del proveedor. La UI solo debe usar estos tipos. */
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "canceled" | "unknown";
export type GameStatus = "not_started" | "running" | "finished" | "unknown";

export interface TeamRef {
  id: number;
  name: string;
  acronym: string | null;
  imageUrl: string | null;
  /** País/región del equipo tal como lo envía la API (sin normalizar). Opcional. */
  location?: string | null;
}

export interface LeagueRef {
  id: number;
  name: string;
  slug: string | null;
  imageUrl: string | null;
}

export interface GameResult {
  id: number;
  position: number | null;
  status: GameStatus;
  winnerTeamId: number | null;
  durationSeconds: number | null;
  startedAt: string | null;
  endedAt: string | null;
  forfeit: boolean;
}

export interface MatchSide {
  team: TeamRef;
  /** null si el marcador no está disponible (p. ej. partido no empezado) */
  score: number | null;
}

export interface Match {
  id: number;
  name: string;
  status: MatchStatus;
  /** ISO 8601 UTC; la conversión a zona local se hace en la UI */
  startTime: string | null;
  endTime: string | null;
  bestOf: number | null;
  league: LeagueRef | null;
  serieName: string | null;
  tournamentName: string | null;
  tournamentId: number | null;
  /** null si hay menos de 2 rivales conocidos (por determinar) */
  sides: [MatchSide, MatchSide] | null;
  winnerTeamId: number | null;
  forfeit: boolean;
  games: GameResult[];
}

export interface League {
  id: number;
  name: string;
  slug: string | null;
  imageUrl: string | null;
}

export interface Tournament {
  id: number;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  leagueId: number | null;
  serieId: number | null;
  tier: string | null;
}

export interface Player {
  id: number;
  name: string;
  fullName: string | null;
  role: string | null;
  nationality: string | null;
  imageUrl: string | null;
  active: boolean | null;
  team: TeamRef | null;
}

export interface Team {
  id: number;
  name: string;
  acronym: string | null;
  imageUrl: string | null;
  region: string | null;
  roster: Player[];
}

export interface Page<T> {
  items: T[];
  page: number;
  perPage: number;
  /** null si la API no envía X-Total */
  total: number | null;
  /** elementos descartados por no cumplir el esquema */
  skipped: number;
}

export interface Standing {
  rank: number | null;
  team: TeamRef;
  wins: number | null;
  losses: number | null;
  ties: number | null;
}
