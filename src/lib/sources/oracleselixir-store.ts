import "server-only";
import type { SnapshotStoreConfig } from "./snapshots";

export type OracleElixirRawRow = Record<string, string | null>;

/** Lee las filas originales de un mapa; Oracle puede repetir gameid entre ligas. */
export function createOracleElixirStore(
  config: SnapshotStoreConfig,
  fetchImpl: typeof fetch = fetch,
) {
  const endpoint = `${config.url.replace(/\/+$/, "")}/rest/v1/oracle_elixir_2025`;
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  return {
    async readRowsForGame(gameId: string, league: string): Promise<OracleElixirRawRow[]> {
      const url = new URL(endpoint);
      url.searchParams.set("select", "*");
      url.searchParams.set("gameid", `eq.${gameId}`);
      url.searchParams.set("league", `eq.${league}`);
      url.searchParams.set("order", "participantid.asc");
      const response = await fetchImpl(url, { headers: { ...headers, Range: "0-99" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Oracle's Elixir read failed (${response.status})`);

      const rows: unknown = await response.json();
      if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
        throw new Error("Oracle's Elixir returned invalid rows");
      }
      if (rows.length > 100) throw new Error("Oracle's Elixir game has too many rows");
      return rows as OracleElixirRawRow[];
    },
  };
}