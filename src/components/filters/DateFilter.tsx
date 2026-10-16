"use client";

import type { DateFilterValue, DatePreset } from "@/lib/filters/types";

export type { DateFilterValue, DatePreset };

interface Props {
  value: DateFilterValue;
  onChange: (next: DateFilterValue) => void;
}

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "today", label: "Hoy" },
  { id: "next7", label: "Próximos 7 días" },
];

/**
 * Selector de fecha: atajos (hoy, próximos días) y calendario nativo.
 * Es controlado: el filtrado real de partidos se aplica en la página (Paso 5).
 */
export function DateFilter({ value, onChange }: Props) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Filtrar por fecha</legend>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={value.preset === p.id}
          onClick={() => onChange({ preset: p.id, date: null })}
          className={`min-h-10 rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
            value.preset === p.id ? "border-accent text-accent" : "border-border bg-surface text-fg"
          }`}
        >
          {p.label}
        </button>
      ))}
      <label className="flex items-center gap-2 text-sm text-muted">
        <span>Día</span>
        <input
          type="date"
          value={value.date ?? ""}
          onChange={(e) => onChange(e.target.value ? { preset: "date", date: e.target.value } : { preset: "all", date: null })}
          className="min-h-10 rounded-md border border-border bg-surface px-2 text-fg"
        />
      </label>
    </fieldset>
  );
}
