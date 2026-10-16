"use client";

import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/lib/hooks";

/** Búsqueda rápida: notifica al padre solo tras 250 ms sin teclear. */
export function SearchBox({ onSearch }: { onSearch: (q: string) => void }) {
  const [text, setText] = useState("");
  const debounced = useDebouncedValue(text, 250);
  useEffect(() => onSearch(debounced), [debounced, onSearch]);

  return (
    <div role="search" className="w-full sm:max-w-md">
      <label htmlFor="busqueda" className="sr-only">Buscar equipo, liga o torneo</label>
      <input
        id="busqueda"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Buscar equipo, liga o torneo…"
        autoComplete="off"
        className="min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />
    </div>
  );
}
