import type { MatchStatus } from "@/types/domain";

/** Iniciales para el fallback de imágenes (máx. 2 caracteres). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "Programado",
  live: "En directo",
  finished: "Finalizado",
  postponed: "Aplazado",
  canceled: "Cancelado",
  unknown: "Estado desconocido",
};

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
