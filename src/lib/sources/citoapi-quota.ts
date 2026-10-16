import "server-only";
import { DataSourceError } from "@/lib/services/errors";
import type { SnapshotStoreConfig } from "./snapshots";

export const CITOAPI_MONTHLY_LIMIT = 500;
export const CITOAPI_RESERVED_CALLS = 25;
export const CITOAPI_CALL_LIMIT = CITOAPI_MONTHLY_LIMIT - CITOAPI_RESERVED_CALLS;

type QuotaFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export async function consumeCitoApiQuota(
  config: SnapshotStoreConfig,
  now: Date = new Date(),
  fetchImpl: QuotaFetch = fetch,
): Promise<number> {
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  let response: Response;
  try {
    response = await fetchImpl(`${config.url.replace(/\/+$/, "")}/rest/v1/rpc/try_bump_source_quota`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_source: "citoapi", p_period: period, p_by: 1, p_limit: CITOAPI_CALL_LIMIT }),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
  } catch {
    throw new DataSourceError("network", "No se pudo comprobar la cuota de CitoAPI");
  }
  if (!response.ok) throw new DataSourceError("network", "No se pudo reservar cuota de CitoAPI", response.status);

  let calls: unknown;
  try {
    calls = await response.json();
  } catch {
    throw new DataSourceError("invalid", "Respuesta inválida del contador de CitoAPI");
  }
  if (calls === null) throw new DataSourceError("rate_limited", "Se alcanzó el margen de seguridad de CitoAPI");
  if (typeof calls !== "number" || !Number.isInteger(calls) || calls < 1 || calls > CITOAPI_CALL_LIMIT) {
    throw new DataSourceError("invalid", "El contador de CitoAPI devolvió un valor inválido");
  }
  return calls;
}