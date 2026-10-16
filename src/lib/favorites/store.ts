/** Favoritos en el navegador (sin cuenta). Funciones puras, sin acceso a `window`. */
export interface FavoriteTeam {
  id: number;
  name: string;
}
export interface Favorites {
  teams: FavoriteTeam[];
}

export const STORAGE_KEY = "lolhub:favorites:v1";
export const MAX_FAVORITES = 30;
export const EMPTY_FAVORITES: Favorites = Object.freeze({ teams: [] }) as Favorites;

/** Lee el JSON guardado de forma tolerante: ignora lo que no tenga el formato esperado. */
export function parseFavorites(raw: string | null): Favorites {
  if (!raw) return EMPTY_FAVORITES;
  try {
    const data: unknown = JSON.parse(raw);
    const list = (data as { teams?: unknown })?.teams;
    if (!Array.isArray(list)) return EMPTY_FAVORITES;
    const seen = new Set<number>();
    const teams: FavoriteTeam[] = [];
    for (const t of list) {
      const id = (t as FavoriteTeam)?.id;
      const name = (t as FavoriteTeam)?.name;
      if (Number.isInteger(id) && id > 0 && typeof name === "string" && !seen.has(id)) {
        seen.add(id);
        teams.push({ id, name: name.slice(0, 80) });
      }
      if (teams.length >= MAX_FAVORITES) break;
    }
    return teams.length ? { teams } : EMPTY_FAVORITES;
  } catch {
    return EMPTY_FAVORITES;
  }
}

export const serializeFavorites = (f: Favorites): string => JSON.stringify({ teams: f.teams });

export const isFavoriteTeam = (f: Favorites, id: number): boolean => f.teams.some((t) => t.id === id);

/** Añade o quita un equipo. Al llegar al máximo, no añade más. */
export function toggleTeam(f: Favorites, team: FavoriteTeam): Favorites {
  if (isFavoriteTeam(f, team.id)) return { teams: f.teams.filter((t) => t.id !== team.id) };
  if (f.teams.length >= MAX_FAVORITES) return f;
  return { teams: [...f.teams, { id: team.id, name: team.name.slice(0, 80) }] };
}
