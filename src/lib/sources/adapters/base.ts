import { DataSourceError, isRetryable, kindFromStatus } from "@/lib/services/errors";
import type { SourceId } from "../catalog";
import { canQuery, type DataKind } from "../routing";
import type { EntityIdentity, SourceMeta } from "@/types/sources";

/**
 * Contrato común de los adaptadores de fuente (12.3.1). Cada adaptador:
 * - declara qué tipos de dato sirve (`kinds`; coincide con el reparto de 12.2, lo verifica una prueba),
 * - pasa por `guardQuery` antes de cualquier llamada de red,
 * - valida lo que recibe y devuelve el modelo interno, nunca el formato del proveedor,
 * - marca cada dato con su fuente y la fecha de obtención.
 */
export interface SourceAdapter {
  readonly id: SourceId;
  readonly kinds: readonly DataKind[];
}

/** Contexto de una consulta: ¿nace de una visita de usuario o de un proceso programado / script? */
export interface QueryContext {
  perVisit: boolean;
}

/** Aplica la política de 12.2. Lanza `DataSourceError("blocked")` si la consulta no está permitida. */
export function guardQuery(kind: DataKind, ctx: QueryContext): void {
  const verdict = canQuery(kind, ctx);
  if (!verdict.ok) throw new DataSourceError("blocked", verdict.reason);
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export const makeMeta = (source: SourceId, now: () => Date = () => new Date()): SourceMeta => ({
  source,
  fetchedAt: now().toISOString(),
});

export interface JsonRequest {
  url: URL;
  headers?: Record<string, string>;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** Reintentos adicionales en 429/5xx/red (progresivos). Por defecto 2 (3 intentos). */
  retries?: number;
  /** Revalidación de Next en segundos; sin valor se fuerza no-store. */
  cacheSeconds?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** GET JSON con timeout y reintentos progresivos solo ante fallos transitorios. Errores tipados. */
export async function getJson(req: JsonRequest): Promise<{ body: unknown; status: number; headers: Headers }> {
  const doFetch = req.fetchImpl ?? ((u: string | URL, i?: RequestInit) => fetch(u, i));
  const sleep = req.sleep ?? defaultSleep;
  const attempts = (req.retries ?? 2) + 1;
  const base = req.baseDelayMs ?? 500;
  const cacheOptions: RequestInit & { next?: { revalidate: number } } =
    req.cacheSeconds && req.cacheSeconds > 0
      ? { next: { revalidate: req.cacheSeconds } }
      : { cache: "no-store" };
  let last: DataSourceError | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let retryAfterMs: number | null = null;
    try {
      const res = await doFetch(req.url, {
        headers: { Accept: "application/json", ...req.headers },
        signal: AbortSignal.timeout(req.timeoutMs ?? 10_000),
        ...cacheOptions,
      });
      if (res.ok) {
        try {
          return { body: await res.json(), status: res.status, headers: res.headers };
        } catch {
          throw new DataSourceError("invalid", "Respuesta no es JSON válido", res.status);
        }
      }
      const ra = Number(res.headers.get("retry-after"));
      retryAfterMs = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 5000) : null;
      last = new DataSourceError(kindFromStatus(res.status), `HTTP ${res.status}`, res.status);
    } catch (e) {
      last = e instanceof DataSourceError ? e : new DataSourceError("network", "Fallo de red");
    }
    if (!isRetryable(last.kind) || attempt === attempts - 1) break;
    await sleep(retryAfterMs ?? Math.min(base * 2 ** attempt, 5000));
  }
  throw last ?? new DataSourceError("network", "Fallo desconocido");
}

/** Normaliza texto para comparar nombres: minúsculas, sin tildes, solo letras y dígitos. */
export function normalizeKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export const blankToNull = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

export type { EntityIdentity };
