"use client";

import { useFavorites } from "@/lib/favorites/useFavorites";

/** Seguir / dejar de seguir un equipo (se guarda en este navegador, sin cuenta). */
export function FavoriteTeamButton({ id, name }: { id: number; name: string }) {
  const { isFavorite, toggle } = useFavorites();
  const on = isFavorite(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => toggle({ id, name })}
      className={`min-h-10 rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        on ? "border-accent text-accent" : "border-border bg-surface text-fg"
      }`}
    >
      <span aria-hidden>{on ? "★" : "☆"}</span> {on ? "Siguiendo" : "Seguir"}
      <span className="sr-only"> a {name}</span>
    </button>
  );
}
