import Link from "next/link";
import { addDays } from "@/lib/dates";
import { TodayButton } from "./TodayButton";

const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es", { timeZone: "UTC", ...opts }).format(new Date(`${day}T12:00:00Z`));

/** Navegación por días: anterior/siguiente, tira de 7 días y selector de fecha (formulario GET). */
export function DayNavigator({ day }: { day: string }) {
  const strip = Array.from({ length: 7 }, (_, i) => addDays(day, i - 3));
  const btn = "min-h-10 inline-flex items-center rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/calendario?fecha=${addDays(day, -1)}`} className={btn}>← Día anterior</Link>
        <Link href={`/calendario?fecha=${addDays(day, 1)}`} className={btn}>Día siguiente →</Link>
        <TodayButton className={btn} />
        <form method="get" action="/calendario" className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <span>Ir a</span>
            <input type="date" name="fecha" defaultValue={day} className="min-h-10 rounded-md border border-border bg-surface px-2 text-fg" />
          </label>
          <button type="submit" className={btn}>Ver</button>
        </form>
      </div>
      <nav aria-label="Días cercanos">
        <ul className="flex gap-1 overflow-x-auto">
          {strip.map((d) => (
            <li key={d}>
              <Link
                href={`/calendario?fecha=${d}`}
                aria-current={d === day ? "date" : undefined}
                className={`flex min-w-14 flex-col items-center rounded-md border px-2 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  d === day ? "border-accent text-accent" : "border-border bg-surface"
                }`}
              >
                <span className="capitalize">{fmt(d, { weekday: "short" })}</span>
                <span className="text-sm font-semibold tabular-nums">{fmt(d, { day: "numeric", month: "short" })}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
