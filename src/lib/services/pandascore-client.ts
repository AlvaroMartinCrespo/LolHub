import "server-only";
import { ConfigError, getPandaScoreToken, PANDASCORE_BASE_URL } from "@/lib/config/env";
import { REVALIDATE, type RevalidateKind } from "@/lib/cache/revalidate";
import { DataSourceError, isRetryable, kindFromStatus } from "./errors";
import { markFetched, markStale } from "./freshness";
import { recall, remember } from "./last-good";
import { recordFailure, recordSuccess } from "./status";
import { getSupabaseConfig } from "@/lib/config/env";
import { createSourceSnapshotStore } from "@/lib/sources/snapshots";
import { z } from "zod";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 5000;
const TIMEOUT_MS = 10_000;
const cachedResponseSchema = z.object({
  body: z.unknown(),
  page: z.number().nullable(),
  perPage: z.number().nullable(),
  total: z.number().nullable(),
  rateLimitRemaining: z.number().nullable(),
  staleSince: z.number().nullable(),
  fetchedAt: z.string().optional(),
});

export interface RawResponse {
  body: unknown;
  page: number | null;
  perPage: number | null;
  total: number | null;
  rateLimitRemaining: number | null;
  /** Instante en que esta aplicación obtuvo la respuesta válida. */
  fetchedAt: string;
  /** ms epoch de la última descarga válida si esta respuesta es de reserva (datos desactualizados); si no, null */
  staleSince: number | null;
}

export interface FetchOptions {
  /** Si la fuente falla (429/5xx/red), servir los últimos datos válidos. Por defecto true. */
  allowStale?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const toInt = (v: string | null) => (v !== null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);

async function savePersistentSnapshot(key: string, value: RawResponse): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  await createSourceSnapshotStore(config).write("pandascore", key, value, value.fetchedAt);
}

async function readPersistentSnapshot(key: string): Promise<{ value: RawResponse; updatedAt: string } | null> {
  const config = getSupabaseConfig();
  if (!config) return null;
  const snapshot = await createSourceSnapshotStore(config).read<unknown>("pandascore", key);
  if (!snapshot) return null;
  const parsed = cachedResponseSchema.safeParse(snapshot.payload);
  if (!parsed.success || !Object.prototype.hasOwnProperty.call(parsed.data, "body")) return null;
  return {
    value: {
      body: parsed.data.body,
      page: parsed.data.page,
      perPage: parsed.data.perPage,
      total: parsed.data.total,
      rateLimitRemaining: parsed.data.rateLimitRemaining,
      fetchedAt: parsed.data.fetchedAt ?? snapshot.updatedAt,
      staleSince: parsed.data.staleSince,
    },
    updatedAt: snapshot.updatedAt,
  };
}

function retryDelay(attempt: number, retryAfter: string | null): number {
  const fromHeader = toInt(retryAfter);
  if (fromHeader !== null) return Math.min(fromHeader * 1000, MAX_DELAY_MS);
  return Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
}

/** GET con reintentos progresivos (429/5xx/red), timeout y errores tipados. */
export async function pandaScoreFetch(
  path: string,
  params: Record<string, string | number> = {},
  kind: RevalidateKind = "catalog",
  options: FetchOptions = {},
): Promise<RawResponse> {
  const { allowStale = true } = options;
  let token: string;
  try {
    token = getPandaScoreToken();
  } catch (e) {
    if (e instanceof ConfigError) throw new DataSourceError("config", e.message);
    throw e;
  }

  const url = new URL(path, PANDASCORE_BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  let last: DataSourceError | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let retryAfter: string | null = null;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: REVALIDATE[kind] },
      });
      if (res.ok) {
        let body: unknown;
        try {
          body = await res.json();
        } catch {
          throw new DataSourceError("invalid", "Respuesta no es JSON válido", res.status);
        }
        const raw: RawResponse = {
          body,
          page: toInt(res.headers.get("x-page")),
          perPage: toInt(res.headers.get("x-per-page")),
          total: toInt(res.headers.get("x-total")),
          rateLimitRemaining: toInt(res.headers.get("x-rate-limit-remaining")),
          fetchedAt: new Date().toISOString(),
          staleSince: null,
        };
        markFetched("pandascore", Date.parse(raw.fetchedAt));
        remember(url.toString(), raw);
        await savePersistentSnapshot(url.toString(), raw).catch(() => undefined);
        recordSuccess(raw.rateLimitRemaining);
        return raw;
      }
      retryAfter = res.headers.get("retry-after");
      last = new DataSourceError(kindFromStatus(res.status), `HTTP ${res.status} en ${path}`, res.status);
    } catch (e) {
      last = e instanceof DataSourceError ? e : new DataSourceError("network", `Fallo de red en ${path}`);
    }
    if (!isRetryable(last.kind) || attempt === MAX_ATTEMPTS - 1) break;
    await sleep(retryDelay(attempt, retryAfter));
  }
  const failure = last ?? new DataSourceError("network", `Fallo desconocido en ${path}`);

  recordFailure(failure.kind);

  // Solo se sirven datos de reserva ante fallos transitorios; 401/403/404 nunca se enmascaran.
  if (allowStale && isRetryable(failure.kind)) {
    const fallback = recall<RawResponse>(url.toString());
    if (fallback) {
      markStale(fallback.savedAt);
      return { ...fallback.value, fetchedAt: fallback.value.fetchedAt ?? new Date(fallback.savedAt).toISOString(), staleSince: fallback.savedAt };
    }
    try {
      const persisted = await readPersistentSnapshot(url.toString());
      if (persisted) {
        const savedAt = Date.parse(persisted.updatedAt);
        markStale(savedAt);
        return { ...persisted.value, staleSince: savedAt };
      }
    } catch {
      // Persistence is best effort; retain the original upstream failure if no fallback is available.
    }
  }
  throw failure;
}

/** Valida una lista elemento a elemento: descarta los inválidos y los cuenta. */
export function parseList<S extends z.ZodTypeAny>(
  body: unknown,
  schema: S,
): { items: z.infer<S>[]; skipped: number } {
  if (!Array.isArray(body)) throw new DataSourceError("invalid", "Se esperaba una lista");
  const items: z.infer<S>[] = [];
  let skipped = 0;
  for (const raw of body) {
    const r = schema.safeParse(raw);
    if (r.success) items.push(r.data);
    else skipped++;
  }
  if (body.length > 0 && items.length === 0) {
    throw new DataSourceError("invalid", "Ningún elemento cumple el esquema esperado");
  }
  return { items, skipped };
}

export function parseOne<S extends z.ZodTypeAny>(body: unknown, schema: S): z.infer<S> {
  const r = schema.safeParse(body);
  if (!r.success) throw new DataSourceError("invalid", "El elemento no cumple el esquema esperado");
  return r.data;
}
