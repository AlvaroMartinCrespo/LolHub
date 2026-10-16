"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  options: Option[];
  /** Valores seleccionados. Vacío = «Todas» */
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel?: string;
}

/** Filtro de selección múltiple accesible por teclado: «Todas» (= sin filtro) y «Restablecer». */
export function MultiSelect({ label, options, selected, onChange, allLabel = "Todas" }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? "1 seleccionada")
        : `${selected.length} seleccionadas`;

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          trigger.current?.focus(); // devuelve el foco al botón
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="text-muted">{label}:</span>
        <span className="max-w-40 truncate">{summary}</span>
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <fieldset
          id={panelId}
          className="absolute z-20 mt-1 max-h-72 min-w-56 overflow-auto rounded-md border border-border bg-surface p-2 shadow-lg"
        >
          <legend className="sr-only">{label}</legend>
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-border/50">
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} className="accent-[rgb(var(--accent))]" />
            {allLabel}
          </label>
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-border/50">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} className="accent-[rgb(var(--accent))]" />
              {o.label}
            </label>
          ))}
          {options.length === 0 && <p className="px-2 py-1.5 text-sm text-muted">Sin opciones disponibles</p>}
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
            className="mt-1 w-full rounded px-2 py-1.5 text-left text-sm text-accent disabled:text-muted"
          >
            Restablecer
          </button>
        </fieldset>
      )}
    </div>
  );
}
