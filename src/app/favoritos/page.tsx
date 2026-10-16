import type { Metadata } from "next";
import { FavoritesView } from "@/components/favorites/FavoritesView";

export const metadata: Metadata = { title: "Favoritos · LoL Hub" };

export default function FavoritesPage() {
  return (
    <section aria-labelledby="fav" className="space-y-4">
      <h1 id="fav" className="text-2xl font-semibold">Equipos favoritos</h1>
      <FavoritesView />
    </section>
  );
}
