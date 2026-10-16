import { z } from "zod";

/**
 * Esquemas de validación del formato externo (PandaScore).
 * Son tolerantes: todo salvo `id` es opcional/nulo, porque el plan o el tipo de dato puede omitir campos.
 * REVISAR contra docs/samples/*.json tras ejecutar `npm run audit` y ajustar lo que difiera.
 */
const str = z.string().nullish();
const num = z.number().nullish();

export const psImageSchema = z.object({ image_url: str });

export const psLeagueSchema = z.object({
  id: z.number(),
  name: str,
  slug: str,
  image_url: str,
  url: str,
  modified_at: str,
});

export const psSerieSchema = z.object({
  id: z.number(),
  name: str,
  full_name: str,
  slug: str,
  year: num,
  season: str,
  begin_at: str,
  end_at: str,
  league_id: num,
});

export const psTournamentSchema = z.object({
  id: z.number(),
  name: str,
  slug: str,
  begin_at: str,
  end_at: str,
  league_id: num,
  serie_id: num,
  tier: str,
  has_bracket: z.boolean().nullish(),
});

export const psPlayerSchema = z.object({
  id: z.number(),
  name: str,
  slug: str,
  first_name: str,
  last_name: str,
  role: str,
  nationality: str,
  image_url: str,
  active: z.boolean().nullish(),
  current_team: z.object({ id: z.number(), name: str, slug: str, acronym: str, image_url: str }).nullish(),
});

export const psTeamSchema = z.object({
  id: z.number(),
  name: str,
  slug: str,
  acronym: str,
  image_url: str,
  location: str,
  players: z.array(psPlayerSchema).nullish(),
});

export const psOpponentSchema = z.object({
  type: str,
  opponent: z.object({ id: z.number(), name: str, slug: str, acronym: str, image_url: str, location: str }),
});

export const psGameSchema = z.object({
  id: z.number(),
  position: num,
  status: str,
  finished: z.boolean().nullish(),
  forfeit: z.boolean().nullish(),
  length: num,
  begin_at: str,
  end_at: str,
  winner: z.object({ id: z.number().nullish(), type: str }).nullish(),
});

export const psMatchSchema = z.object({
  id: z.number(),
  name: str,
  slug: str,
  status: str,
  scheduled_at: str,
  begin_at: str,
  end_at: str,
  original_scheduled_at: str,
  number_of_games: num,
  match_type: str,
  forfeit: z.boolean().nullish(),
  winner_id: num,
  draw: z.boolean().nullish(),
  league: psLeagueSchema.partial({ id: true }).nullish(),
  serie: psSerieSchema.partial({ id: true }).nullish(),
  tournament: psTournamentSchema.partial({ id: true }).nullish(),
  opponents: z.array(psOpponentSchema).nullish(),
  results: z.array(z.object({ team_id: num, score: num })).nullish(),
  games: z.array(psGameSchema).nullish(),
});

export const psStandingSchema = z.object({
  rank: num,
  wins: num,
  losses: num,
  ties: num,
  team: z.object({ id: z.number(), name: str, acronym: str, image_url: str, location: str }),
});

export type PsStanding = z.infer<typeof psStandingSchema>;
export type PsLeague = z.infer<typeof psLeagueSchema>;
export type PsSerie = z.infer<typeof psSerieSchema>;
export type PsTournament = z.infer<typeof psTournamentSchema>;
export type PsPlayer = z.infer<typeof psPlayerSchema>;
export type PsTeam = z.infer<typeof psTeamSchema>;
export type PsMatch = z.infer<typeof psMatchSchema>;
