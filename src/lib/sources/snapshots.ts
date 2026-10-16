import "server-only";
import type { SourceId } from "./catalog";

export interface SourceSnapshot<T = unknown> {
  payload: T;
  updatedAt: string;
}

export interface SourceSnapshotStore {
  read<T>(source: SourceId, key: string): Promise<SourceSnapshot<T> | null>;
  write<T>(source: SourceId, key: string, payload: T, updatedAt: string): Promise<void>;
}

export interface SnapshotStoreConfig {
  url: string;
  serviceRoleKey: string;
}

/** Supabase REST store; its credentials must only be supplied by server code. */
export function createSourceSnapshotStore(
  config: SnapshotStoreConfig,
  fetchImpl: typeof fetch = fetch,
): SourceSnapshotStore {
  const endpoint = `${config.url.replace(/\/+$/, "")}/rest/v1/source_snapshots`;
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  return {
    async read<T>(source: SourceId, key: string): Promise<SourceSnapshot<T> | null> {
      const url = new URL(endpoint);
      url.searchParams.set("select", "payload,updated_at");
      url.searchParams.set("source", `eq.${source}`);
      url.searchParams.set("cache_key", `eq.${key}`);
      const response = await fetchImpl(url, { headers, cache: "no-store" });
      if (!response.ok) throw new Error(`Supabase snapshot read failed (${response.status})`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const row = rows[0];
      if (!row || typeof row !== "object") return null;
      const record = row as { payload?: unknown; updated_at?: unknown };
      if (typeof record.updated_at !== "string" || !Number.isFinite(Date.parse(record.updated_at))) return null;
      return { payload: record.payload as T, updatedAt: record.updated_at };
    },

    async write<T>(source: SourceId, key: string, payload: T, updatedAt: string): Promise<void> {
      const url = new URL(endpoint);
      url.searchParams.set("on_conflict", "source,cache_key");
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ source, cache_key: key, payload, updated_at: updatedAt }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Supabase snapshot write failed (${response.status})`);
    },
  };
}