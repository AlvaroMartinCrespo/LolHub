import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");
const v = (name: string): [number, number, number] => {
  const m = css.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`));
  if (!m) throw new Error(`Falta --${name}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

const lum = ([r, g, b]: number[]) => {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: number[], b: number[]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Mezcla un color con transparencia `alpha` sobre un fondo. */
const over = (fg: number[], bg: number[], alpha: number) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

const bg = v("bg"), surface = v("surface"), border = v("border"), fg = v("fg"), muted = v("muted"), accent = v("accent");

describe("contraste WCAG AA (texto normal ≥ 4.5:1)", () => {
  const cases: [string, number[], number[]][] = [
    ["texto sobre fondo", fg, bg],
    ["texto sobre superficie", fg, surface],
    ["texto atenuado sobre fondo", muted, bg],
    ["texto atenuado sobre superficie", muted, surface],
    ["texto atenuado sobre iniciales (bg-border)", muted, border],
    ["acento sobre fondo", accent, bg],
    ["acento sobre superficie", accent, surface],
    ["botón principal (texto fondo sobre acento)", bg, accent],
    ["error (red-300) sobre fondo con tinte", hex("#fca5a5"), over(hex("#ef4444"), bg, 0.1)],
    ["error (red-200) sobre tarjeta de error", hex("#fecaca"), over(hex("#ef4444"), bg, 0.1)],
    ["directo (red-300) sobre superficie con tinte", hex("#fca5a5"), over(hex("#ef4444"), surface, 0.1)],
    ["aviso (amber-200) sobre fondo con tinte", hex("#fde68a"), over(hex("#f59e0b"), bg, 0.1)],
    ["aviso (amber-300) sobre fondo", hex("#fcd34d"), bg],
    ["victoria (emerald-300) sobre fondo", hex("#6ee7b7"), bg],
    ["victoria (emerald-300) sobre insignia", hex("#6ee7b7"), over(hex("#10b981"), bg, 0.2)],
    ["derrota (red-300) sobre insignia", hex("#fca5a5"), over(hex("#ef4444"), bg, 0.2)],
  ];
  it.each(cases)("%s", (_n, a, b) => {
    expect(ratio(a, b)).toBeGreaterThanOrEqual(4.5);
  });
});
