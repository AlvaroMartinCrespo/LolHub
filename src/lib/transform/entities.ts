import type { League, Player, Standing, Team, TeamRef, Tournament } from "@/types/domain";
import type { PsLeague, PsPlayer, PsStanding, PsTeam, PsTournament } from "@/types/pandascore";
import { clean, joinName, toIso } from "./common";

export const normalizeLeague = (l: PsLeague): League => ({
  id: l.id,
  name: clean(l.name) ?? "Liga",
  slug: clean(l.slug),
  imageUrl: clean(l.image_url),
});

export const normalizeTournament = (t: PsTournament): Tournament => ({
  id: t.id,
  name: clean(t.name) ?? "Torneo",
  startsAt: toIso(t.begin_at),
  endsAt: toIso(t.end_at),
  leagueId: t.league_id ?? null,
  serieId: t.serie_id ?? null,
  tier: clean(t.tier),
});

export const normalizePlayer = (p: PsPlayer): Player => {
  const team: TeamRef | null = p.current_team
    ? {
        id: p.current_team.id,
        name: clean(p.current_team.name) ?? "Equipo",
        acronym: clean(p.current_team.acronym),
        imageUrl: clean(p.current_team.image_url),
      }
    : null;
  return {
    id: p.id,
    name: clean(p.name) ?? "Jugador",
    fullName: joinName(p.first_name, p.last_name),
    role: clean(p.role),
    nationality: clean(p.nationality),
    imageUrl: clean(p.image_url),
    active: p.active ?? null,
    team,
  };
};

export const normalizeTeam = (t: PsTeam): Team => ({
  id: t.id,
  name: clean(t.name) ?? "Equipo",
  acronym: clean(t.acronym),
  imageUrl: clean(t.image_url),
  region: clean(t.location),
  roster: (t.players ?? []).map(normalizePlayer),
});

export const normalizeStanding = (s: PsStanding): Standing => ({
  rank: s.rank ?? null,
  team: {
    id: s.team.id,
    name: clean(s.team.name) ?? "Equipo",
    acronym: clean(s.team.acronym),
    imageUrl: clean(s.team.image_url),
    location: clean(s.team.location),
  },
  wins: s.wins ?? null,
  losses: s.losses ?? null,
  ties: s.ties ?? null,
});
