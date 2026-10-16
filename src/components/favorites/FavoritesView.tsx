"use client";

import Link from "next/link";
import { useFavorites } from "@/lib/favorites/useFavorites";
import { EmptyState } from "../states/EmptyState";

export function FavoritesView() {
  const { favorites, toggle } = useFavorites();
  if (favorites.teams.length === 0) {
    return (
      <EmptyState
        title="Todavía no sigues a ningún equipo"
        description="Abre la ficha de un equipo y pulsa «Seguir». Se guarda solo en este navegador."
        action={<Link href="/competiciones" className="text-accent">Explorar competiciones</Link>}
      />
    );
  }
  const ids = favorites.teams.map((t) => t.id).join(",");
  const linkCls = "min-h-10 inline-flex items-center rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-2">
        {favorites.teams.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3">
            <Link href={`/equipos/${t.id}`} className="truncate font-medium hover:text-accent">{t.name}</Link>
            <button
              type="button"
              onClick={() => toggle(t)}
              className="min-h-10 rounded-md px-2 text-sm text-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Quitar<span className="sr-only"> a {t.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Link href={`/favoritos/proximos?ids=${ids}`} className={linkCls}>Ver próximos partidos</Link>
        <a href={`/favoritos/ics?ids=${ids}`} className={linkCls}>Exportar al calendario (.ics)</a>
      </div>
      <p className="text-sm text-muted">Los favoritos se guardan en este navegador: no se sincronizan entre dispositivos.</p>
    </div>
  );
}
