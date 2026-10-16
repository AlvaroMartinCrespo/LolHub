export const parseId = (raw: string): number | null => (/^\d{1,12}$/.test(raw) ? Number(raw) : null);

export function parsePage(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = v && /^\d{1,4}$/.test(v) ? Number(v) : 1;
  return n >= 1 ? n : 1;
}
