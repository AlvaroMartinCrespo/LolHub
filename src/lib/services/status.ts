import "server-only";

/** Estado de la fuente de datos observado por esta instancia del servidor (best effort). */
interface UpstreamStatus {
  lastSuccessAt: number | null;
  lastRateLimitRemaining: number | null;
  lastFailure: { at: number; kind: string } | null;
}
const state: UpstreamStatus = { lastSuccessAt: null, lastRateLimitRemaining: null, lastFailure: null };

export function recordSuccess(rateLimitRemaining: number | null, now = Date.now()): void {
  state.lastSuccessAt = now;
  if (rateLimitRemaining !== null) state.lastRateLimitRemaining = rateLimitRemaining;
}
export function recordFailure(kind: string, now = Date.now()): void {
  state.lastFailure = { at: now, kind };
}
export const getUpstreamStatus = (): UpstreamStatus => ({ ...state, lastFailure: state.lastFailure && { ...state.lastFailure } });
