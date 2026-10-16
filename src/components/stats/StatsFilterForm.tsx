import Link from "next/link";
import type { StatsFilterOptions, StatsFilters } from "@/lib/stats/filters";
import { hasStatsFilters } from "@/lib/stats/filters";

interface Props {
  /** Ruta a la que se envía el formulario (GET) */
  action: string;
  /** Parámetros que deben conservarse (p. ej. a y b en la comparativa) */
  hidden?: Record<string, string>;
  options: StatsFilterOptions;
  value: StatsFilters;
}

const sel = "min-h-10 rounded-md border border-border bg-surface px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

/** Formulario con selects nativos: funciona sin JavaScript (navegación GET). */
export function StatsFilterForm({ action, hidden = {}, options, value }: Props) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Periodo</span>
        <select name="period" defaultValue={value.period} className={sel}>
          <option value="all">Todo el historial cargado</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Temporada / serie</span>
        <select name="season" defaultValue={value.season} className={sel}>
          <option value="">Todas</option>
          {options.seasons.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Torneo</span>
        <select name="tournament" defaultValue={value.tournament} className={sel}>
          <option value="">Todos</option>
          {options.tournaments.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Formato</span>
        <select name="bestOf" defaultValue={value.bestOf} className={sel}>
          <option value="">Todos</option>
          {options.formats.map((f) => <option key={f} value={f}>Al mejor de {f}</option>)}
        </select>
      </label>
      <button type="submit" className="min-h-10 rounded-md bg-accent px-4 text-sm font-semibold text-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg">
        Aplicar
      </button>
      {hasStatsFilters(value) && (
        <Link
          href={{ pathname: action, query: hidden }}
          className="min-h-10 content-center px-2 text-sm text-accent"
        >
          Restablecer
        </Link>
      )}
    </form>
  );
}
