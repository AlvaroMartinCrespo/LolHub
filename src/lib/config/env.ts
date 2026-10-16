import "server-only";

/** Lee el token solo en servidor. Nunca usar NEXT_PUBLIC_* para secretos. */
export function getPandaScoreToken(): string {
  const token = process.env.PANDASCORE_API_TOKEN;
  if (!token) {
    throw new ConfigError("Falta la variable de entorno PANDASCORE_API_TOKEN.");
  }
  return token;
}

/**
 * Supabase (solo servidor). La service role key salta RLS: nunca al navegador ni NEXT_PUBLIC_*.
 * Devuelve null si no está configurada (la web sigue funcionando solo con PandaScore).
 */
export function getSupabaseConfig(): { url: string; serviceRoleKey: string } | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  if (!/^https:\/\//.test(url)) throw new ConfigError("SUPABASE_URL debe empezar por https://");
  return { url: url.replace(/\/+$/, ""), serviceRoleKey };
}

/** Clave de CitoAPI (solo servidor). Lanza ConfigError si falta: la fuente es opcional, el llamador decide. */
export function getCitoApiKey(): string {
  const key = process.env.CITOAPI_KEY;
  if (!key) throw new ConfigError("Falta la variable de entorno CITOAPI_KEY.");
  return key;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export const PANDASCORE_BASE_URL = "https://api.pandascore.co";
/** Documentado en https://citoapi.com/docs/api/league-of-legends/ (consultado el 16/10/2026). */
export const CITOAPI_BASE_URL = "https://api.citoapi.com/api/v1";
/** Endpoint de MediaWiki/Cargo de Leaguepedia. */
export const LEAGUEPEDIA_API_URL = "https://lol.fandom.com/api.php";
