import { ALARM_CHOICES } from "@/lib/ics";

/** Descarga .ics con recordatorio opcional. Formulario GET: funciona sin JavaScript. */
export function CalendarExport({ matchId }: { matchId: number }) {
  return (
    <form method="get" action={`/partidos/${matchId}/ics`} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Recordatorio</span>
        <select name="aviso" defaultValue="15" className="min-h-10 rounded-md border border-border bg-bg px-2 text-sm">
          {ALARM_CHOICES.map((m) => (
            <option key={m} value={m}>{m === 0 ? "Sin recordatorio" : `${m} min antes`}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="min-h-10 rounded-md bg-accent px-4 text-sm font-semibold text-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg">
        Añadir al calendario (.ics)
      </button>
    </form>
  );
}
