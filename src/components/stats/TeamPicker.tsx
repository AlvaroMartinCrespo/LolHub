import Link from "next/link";
import type { Team } from "@/types/domain";

interface Props {
  slot: "a" | "b";
  label: string;
  selected: Team | null;
  query: string;
  candidates: Team[] | null;
  /** Parámetros actuales para construir los enlaces de selección */
  current: Record<string, string>;
}

/** Selector de equipo por nombre; funciona con formulario GET (sin JS). */
export function TeamPicker({ slot, label, selected, query, candidates, current }: Props) {
  const qName = slot === "a" ? "qa" : "qb";
  const link = (teamId: number) => {
    const p = new URLSearchParams(current);
    p.set(slot, String(teamId));
    p.delete(qName);
    return `/comparar?${p.toString()}`;
  };
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <p className="text-sm text-muted">{label}</p>
      {selected && <p className="font-semibold">{selected.name}</p>}
      <label className="flex flex-col gap-1 text-sm">
        <span className="sr-only">Buscar {label} por nombre</span>
        <input
          type="search"
          name={qName}
          defaultValue={query}
          placeholder={selected ? "Cambiar equipo…" : "Buscar por nombre…"}
          maxLength={60}
          className="min-h-10 rounded-md border border-border bg-bg px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </label>
      {candidates && (
        candidates.length === 0 ? (
          <p className="text-sm text-muted">Sin resultados para «{query}».</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {candidates.map((t) => (
              <li key={t.id}><Link href={link(t.id)} className="text-accent hover:underline">{t.name}</Link></li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
