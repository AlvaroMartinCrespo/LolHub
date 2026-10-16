"use client";

import type { Period } from "@/lib/filters/types";

const OPTIONS: { value: Period; label: string }[] = [
  { value: "all", label: "Todo el historial cargado" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "90d", label: "Últimos 90 días" },
];

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm">
      <span className="text-muted">Periodo:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Period)}
        className="bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface">{o.label}</option>
        ))}
      </select>
    </label>
  );
}
