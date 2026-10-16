import type { League } from "@/types/domain";

export type IntlKind = "worlds" | "msi";

/** Búsquedas que se lanzan contra la API (los nombres reales deben confirmarse con las respuestas). */
export const INTL_QUERIES: Record<IntlKind, string[]> = {
  worlds: ["worlds", "world championship"],
  msi: ["msi", "mid-season invitational"],
};

const PATTERNS: Record<IntlKind, RegExp> = {
  worlds: /\bworlds?\b|world championship/i,
  msi: /\bmsi\b|mid-?season invitational/i,
};

/** Clasifica ligas por nombre y las deduplica. Las de nombre exacto («Worlds», «MSI») van primero. */
export function classifyInternationals(leagues: League[]): Record<IntlKind, League[]> {
  const out: Record<IntlKind, League[]> = { worlds: [], msi: [] };
  const seen = new Set<number>();
  for (const l of leagues) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    (Object.keys(PATTERNS) as IntlKind[]).forEach((k) => {
      if (PATTERNS[k].test(l.name)) out[k].push(l);
    });
  }
  const exact = (k: IntlKind, l: League) => (k === "worlds" ? /^worlds$/i : /^msi$/i).test(l.name.trim()) ? 0 : 1;
  (Object.keys(out) as IntlKind[]).forEach((k) => out[k].sort((a, b) => exact(k, a) - exact(k, b) || a.name.localeCompare(b.name)));
  return out;
}
