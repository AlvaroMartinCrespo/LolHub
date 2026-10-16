/** Utilidades de fechas «YYYY-MM-DD» (sin zona horaria: se opera en UTC sobre la cadena). */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(raw: string | undefined | null): string | null {
  if (!raw || !DAY_RE.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw ? null : raw;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const todayUtc = (now = new Date()): string => now.toISOString().slice(0, 10);

/**
 * Ventana UTC que cubre el día local elegido en cualquier zona horaria (UTC−12 … UTC+14):
 * desde el día anterior a las 00:00Z hasta dos días después. El recorte exacto se hace en el navegador.
 */
export function dayWindow(day: string): { from: string; to: string } {
  return { from: `${addDays(day, -1)}T00:00:00Z`, to: `${addDays(day, 2)}T00:00:00Z` };
}

export function parseIdList(raw: string | undefined | null, max = 10): number[] {
  if (!raw) return [];
  const out: number[] = [];
  for (const p of raw.split(",")) {
    if (/^\d{1,12}$/.test(p.trim())) {
      const n = Number(p);
      if (!out.includes(n)) out.push(n);
    }
    if (out.length >= max) break;
  }
  return out;
}
