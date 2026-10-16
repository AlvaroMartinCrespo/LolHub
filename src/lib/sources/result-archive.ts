import "server-only";
import { getSupabaseConfig } from "@/lib/config/env";
import type { Match } from "@/types/domain";

export interface ArchivedLeague {
  league_id: number;
  league_name: string;
  last_result_at: string | null;
}

export interface ArchivedMatchesPage {
  items: Match[];
  total: number | null;
}

export interface ResultArchiveStoreConfig {
  url: string;
  serviceRoleKey: string;
}

const PAGE_SIZE = 24;
const REQUEST_TIMEOUT_MS = 5000;

export function createResultArchiveStore(
  config: ResultArchiveStoreConfig,
  fetchImpl: typeof fetch = fetch,
) {
  const baseUrl = config.url.replace(/\/+$/, "");
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  return {
    async write(matches: Match[]): Promise<void> {
      const finished = [...new Map(
        matches
          .filter((match) => match.status === "finished" && match.league !== null)
          .map((match) => [match.id, match]),
      ).values()];
      if (finished.length === 0) return;
      const updatedAt = new Date().toISOString();

      const latestByLeague = new Map<number, ArchivedLeague & { last_result_at: string | null }>();
      for (const match of finished) {
        if (!match.league) continue;
        const date = match.endTime ?? match.startTime;
        const current = latestByLeague.get(match.league.id);
        if (!current || (date && (!current.last_result_at || Date.parse(date) > Date.parse(current.last_result_at)))) {
          latestByLeague.set(match.league.id, {
            league_id: match.league.id,
            league_name: match.league.name,
            last_result_at: date,
            updated_at: updatedAt,
          });
        }
      }

      const leagueUrl = new URL(`${baseUrl}/rest/v1/match_result_archive_leagues`);
      leagueUrl.searchParams.set("on_conflict", "league_id");
      const matchUrl = new URL(`${baseUrl}/rest/v1/match_result_archive`);
      matchUrl.searchParams.set("on_conflict", "match_id");
      const prefer = "resolution=merge-duplicates,return=minimal";
      const [leagueResponse, matchResponse] = await Promise.all([
        fetchImpl(leagueUrl, {
          method: "POST",
          headers: { ...headers, Prefer: prefer },
          body: JSON.stringify([...latestByLeague.values()]),
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }),
        fetchImpl(matchUrl, {
          method: "POST",
          headers: { ...headers, Prefer: prefer },
          body: JSON.stringify(finished.map((match) => ({
            match_id: match.id,
            league_id: match.league!.id,
            played_at: match.endTime ?? match.startTime,
            payload: match,
            updated_at: updatedAt,
          }))),
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }),
      ]);
      if (!leagueResponse.ok || !matchResponse.ok) {
        throw new Error(`Supabase result archive write failed (${leagueResponse.status}/${matchResponse.status})`);
      }
    },

    async listLeagues(): Promise<ArchivedLeague[]> {
      const url = new URL(`${baseUrl}/rest/v1/match_result_archive_leagues`);
      url.searchParams.set("select", "league_id,league_name,last_result_at");
      url.searchParams.set("order", "league_name.asc,league_id.asc");
      url.searchParams.set("limit", "500");
      const response = await fetchImpl(url, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Supabase result archive read failed (${response.status})`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) return [];
      return rows.filter((row): row is ArchivedLeague =>
        !!row && typeof row === "object" &&
        typeof (row as ArchivedLeague).league_id === "number" &&
        typeof (row as ArchivedLeague).league_name === "string",
      );
    },

    async listLeagueMatches(leagueId: number, page: number): Promise<ArchivedMatchesPage> {
      const url = new URL(`${baseUrl}/rest/v1/match_result_archive`);
      url.searchParams.set("select", "payload");
      url.searchParams.set("league_id", `eq.${leagueId}`);
      url.searchParams.set("order", "played_at.desc.nullslast,match_id.desc");
      url.searchParams.set("limit", String(PAGE_SIZE));
      const from = (Math.max(1, page) - 1) * PAGE_SIZE;
      const response = await fetchImpl(url, {
        headers: { ...headers, Prefer: "count=exact", Range: `${from}-${from + PAGE_SIZE - 1}` },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Supabase result archive read failed (${response.status})`);
      const rows: unknown = await response.json();
      const items = Array.isArray(rows)
        ? rows.flatMap((row) => {
          if (!row || typeof row !== "object") return [];
          const match = (row as { payload?: unknown }).payload;
          return match && typeof match === "object" && !Array.isArray(match) &&
            typeof (match as Match).id === "number" && (match as Match).status === "finished"
            ? [match as Match]
            : [];
        })
        : [];
      const range = response.headers.get("content-range");
      const totalText = range?.split("/")[1];
      const total = totalText && totalText !== "*" && Number.isFinite(Number(totalText)) ? Number(totalText) : null;
      return { items, total };
    },
  };
}

/** Archiving is best-effort so a Supabase outage never breaks live results. */
export async function archiveFinishedMatches(matches: Match[]): Promise<void> {
  try {
    const config = getSupabaseConfig();
    if (config) await createResultArchiveStore(config).write(matches);
  } catch {
    return;
  }
}

export async function getArchivedLeagues(): Promise<ArchivedLeague[]> {
  const config = getSupabaseConfig();
  return config ? createResultArchiveStore(config).listLeagues() : [];
}

export async function getArchivedLeagueMatches(leagueId: number, page: number): Promise<ArchivedMatchesPage> {
  const config = getSupabaseConfig();
  return config
    ? createResultArchiveStore(config).listLeagueMatches(leagueId, page)
    : { items: [], total: 0 };
}