import type { TeamRef } from "@/types/domain";
import { SafeImage } from "./ui/SafeImage";

export function TeamBadge({ team, size = 32 }: { team: TeamRef; size?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <SafeImage src={team.imageUrl} alt={`Logo de ${team.name}`} fallbackName={team.name} size={size} />
      <span className="truncate font-medium">{team.name}</span>
    </span>
  );
}
