import type { Metadata } from "next";
import { REVALIDATE } from "@/lib/cache/revalidate";
import { snapshot } from "@/lib/services/last-good";
import { getUpstreamStatus } from "@/lib/services/status";
import { LocalTime } from "@/components/ui/LocalTime";
import { FreshnessNotice } from "@/components/states/FreshnessNotice";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estado de los datos · LoL Hub" };

const LABEL: Record<keyof typeof REVALIDATE, string> = {
  running: "Partidos en directo", detail: "Ficha de partido", upcoming: "Próximos partidos",
  finished: "Resultados recientes", catalog: "Ligas, torneos, equipos, jugadores",
  historical: "Historial (estadísticas)", health: "Comprobación de salud",
};
const secs = (s: number) => (s === 0 ? "sin caché" : s < 60 ? `${s} s` : s < 3600 ? `${s / 60} min` : `${s / 3600} h`);
const age = (ms: number) => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? `hace ${s} s` : s < 3600 ? `hace ${Math.round(s / 60)} min` : `hace ${Math.round(s / 3600)} h`; };
const show = (key: string) => { try { const u = new URL(key); return decodeURIComponent(u.pathname + u.search); } catch { return key; } };

export default function StatusPage() {
  const up = getUpstreamStatus();
  const entries = snapshot().slice(0, 25);
  const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

  return (
    <div className="space-y-8">
      <FreshnessNotice />
      <h1 className="text-2xl font-semibold">Estado de los datos</h1>
      <p className="text-sm text-muted">
        Panel informativo de esta instancia del servidor. En serverless cada instancia tiene su propia memoria, por lo que las cifras pueden variar entre visitas.
      </p>

      <section aria-labelledby="fuente" className="space-y-2">
        <h2 id="fuente" className="text-xl font-semibold">Fuente (PandaScore)</h2>
        <dl className="grid gap-x-6 gap-y-2 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-2">
          <div className="flex gap-2"><dt className="text-muted">Última respuesta correcta:</dt><dd>{up.lastSuccessAt ? <LocalTime iso={iso(up.lastSuccessAt)} /> : "Ninguna aún"}</dd></div>
          <div className="flex gap-2"><dt className="text-muted">Cuota restante (última lectura):</dt><dd>{up.lastRateLimitRemaining ?? "Sin dato"}</dd></div>
          <div className="flex gap-2"><dt className="text-muted">Último fallo:</dt><dd>{up.lastFailure ? <>{up.lastFailure.kind} · <LocalTime iso={iso(up.lastFailure.at)} /></> : "Ninguno"}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="caches" className="space-y-2">
        <h2 id="caches" className="text-xl font-semibold">Frecuencia de actualización por tipo</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <caption className="sr-only">Tiempo de caché por tipo de dato</caption>
            <thead className="bg-surface text-muted"><tr><th scope="col" className="px-3 py-2">Dato</th><th scope="col" className="px-3 py-2">Se renueva cada</th></tr></thead>
            <tbody>
              {(Object.keys(REVALIDATE) as (keyof typeof REVALIDATE)[]).map((k) => (
                <tr key={k} className="border-t border-border"><th scope="row" className="px-3 py-2 font-medium">{LABEL[k]}</th><td className="px-3 py-2">{secs(REVALIDATE[k])}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ultimos" className="space-y-2">
        <h2 id="ultimos" className="text-xl font-semibold">Últimas consultas guardadas</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">Esta instancia aún no ha consultado la fuente.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {entries.map((e) => (
              <li key={e.key} className="flex flex-wrap justify-between gap-2 rounded border border-border px-3 py-2">
                <code className="break-all">{show(e.key)}</code><span className="text-muted">{age(e.savedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
