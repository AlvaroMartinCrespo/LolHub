import type { FormResult, TeamStats } from "@/lib/stats/formulas";
import { MIN_SAMPLE } from "@/lib/stats/formulas";
import type { ConsistencyReport } from "@/lib/stats/validate";
import { LocalTime } from "../ui/LocalTime";

export const pct = (v: number | null) => (v === null ? "–" : `${v.toFixed(1)} %`);

export function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
    </div>
  );
}

/** Barra victorias/derrotas. Solo se dibuja si la muestra es fiable. */
export function SplitBar({ label, wins, losses, reliable }: { label: string; wins: number; losses: number; reliable: boolean }) {
  const total = wins + losses;
  if (!reliable || total === 0) {
    return <p className="text-sm text-muted">{label}: gráfico no mostrado (muestra insuficiente).</p>;
  }
  const w = (wins / total) * 100;
  return (
    <div>
      <p className="mb-1 text-sm text-muted">{label}</p>
      <div role="img" aria-label={`${label}: ${wins} victorias y ${losses} derrotas`} className="flex h-3 overflow-hidden rounded bg-red-500/50">
        <div style={{ width: `${w}%` }} className="bg-emerald-500/80" />
      </div>
      <p className="mt-1 text-xs text-muted tabular-nums">{wins} V · {losses} D</p>
    </div>
  );
}

export function FormStrip({ form }: { form: FormResult[] }) {
  if (form.length === 0) return <p className="text-sm text-muted">Sin series en la muestra.</p>;
  return (
    <ol className="flex gap-1" aria-label="Últimos resultados, del más reciente al más antiguo">
      {form.map((r, i) => (
        <li
          key={i}
          className={`inline-flex h-7 w-7 items-center justify-center rounded text-xs font-bold ${
            r === "W" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
          }`}
        >
          <span aria-hidden>{r === "W" ? "V" : "D"}</span>
          <span className="sr-only">{r === "W" ? "Victoria" : "Derrota"}</span>
        </li>
      ))}
    </ol>
  );
}

/** Periodo y tamaño de muestra: se muestran siempre junto a las métricas. */
export function SampleNotice({ stats, truncated }: { stats: TeamStats; truncated?: boolean }) {
  const { sample } = stats;
  const ex = sample.excluded;
  return (
    <div className="space-y-1 rounded-md border border-border p-3 text-sm" role="note">
      <p>
        <strong>Muestra:</strong> {sample.series} series y {sample.maps} mapas
        {sample.from && sample.to && (
          <>
            {" "}· <strong>Periodo:</strong> <LocalTime iso={sample.from} /> – <LocalTime iso={sample.to} />
          </>
        )}
      </p>
      {(ex.forfeit > 0 || ex.noWinner > 0 || ex.notFinished > 0) && (
        <p className="text-muted">
          Excluidos: {ex.forfeit} por incomparecencia, {ex.noWinner} sin ganador, {ex.notFinished} no finalizados.
        </p>
      )}
      {truncated && (
        <p className="text-amber-300">Se cargaron los 300 partidos más recientes; puede haber historial anterior no incluido.</p>
      )}
      {!stats.reliable && (
        <p className="text-amber-300">
          Muestra pequeña (menos de {MIN_SAMPLE} series): los porcentajes no son fiables y no se dibujan gráficos.
        </p>
      )}
      {stats.mixedFormats && (
        <p className="text-amber-300">
          Formatos mezclados ({Object.entries(stats.formats).map(([k, v]) => `${k}: ${v}`).join(", ")}). El % de series no es
          comparable entre formatos; filtra por formato o usa el % de mapas.
        </p>
      )}
    </div>
  );
}

export function ConsistencyNote({ report }: { report: ConsistencyReport }) {
  return (
    <p className={`text-xs ${report.ok ? "text-muted" : "text-amber-300"}`}>
      Validación de cálculos: {report.ok ? "correcta" : "con avisos"} · {report.crossChecked} series cruzadas con sus mapas
      {report.mismatches > 0 && <> · {report.mismatches} con marcador distinto a los mapas</>}
      {!report.totalsOk && <> · los totales no cuadran</>}.
    </p>
  );
}
