import Link from "next/link";
import type { Team } from "@/types/domain";
import { SafeImage } from "./ui/SafeImage";

export function TeamCard({ team, href }: { team: Team; href?: string }) {
  const content = (
    <article className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/60">
      <SafeImage src={team.imageUrl} alt={`Logo de ${team.name}`} fallbackName={team.name} size={48} />
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{team.name}</h3>
        <p className="truncate text-sm text-muted">
          {[team.acronym, team.region].filter(Boolean).join(" · ") || "Sin datos adicionales"}
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
