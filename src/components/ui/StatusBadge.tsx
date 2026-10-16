import type { MatchStatus } from "@/types/domain";
import { STATUS_LABEL } from "@/lib/format/text";

const STYLE: Record<MatchStatus, string> = {
  scheduled: "border-border text-muted",
  live: "border-red-500/60 bg-red-500/10 text-red-300",
  finished: "border-emerald-500/40 text-emerald-300",
  postponed: "border-amber-500/50 text-amber-300",
  canceled: "border-border text-muted line-through",
  unknown: "border-border text-muted",
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {status === "live" && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
      {STATUS_LABEL[status]}
    </span>
  );
}
