import Link from "next/link";
import type { Player } from "@/types/domain";
import { SafeImage } from "./ui/SafeImage";

export function PlayerCard({ player, href }: { player: Player; href?: string }) {
  const content = (
    <article className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/60">
      <SafeImage src={player.imageUrl} alt={`Foto de ${player.name}`} fallbackName={player.name} size={48} rounded="full" />
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{player.name}</h3>
        <p className="truncate text-sm text-muted">
          {[player.role, player.team?.name, player.nationality].filter(Boolean).join(" · ") || "Sin datos adicionales"}
        </p>
      </div>
    </article>
  );
  return href ? (
    <Link href={href} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
      {content}
    </Link>
  ) : (
    content
  );
}
