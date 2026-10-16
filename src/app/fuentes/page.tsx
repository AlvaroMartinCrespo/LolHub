import type { Metadata } from "next";
import { RESPONSIBILITIES } from "@/lib/sources/routing";
import {
  NOT_RECOMMENDED, RIOT_DISCLAIMER, SOURCES, SOURCES_RESEARCHED_ON, getSource,
  type SourceInfo, type SourceRole,
} from "@/lib/sources/catalog";

export const metadata: Metadata = { title: "Fuentes y atribución · LoL Hub" };

const ROLE: Record<SourceRole, string> = { principal: "Principal", complementaria: "Complementaria", futura: "Futura" };

function SourceCard({ s }: { s: SourceInfo }) {
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{s.name}</h3>
        <span className="rounded border border-border px-2 py-0.5 text-xs text-muted">{ROLE[s.role]}</span>
      </div>
      <dl className="mt-2 space-y-1 text-sm">
        <div><dt className="inline text-muted">Plan gratuito: </dt><dd className="inline">{s.freePlan}</dd></div>
        <div><dt className="inline text-muted">Uso en LoL Hub: </dt><dd className="inline">{s.usedFor}</dd></div>
        <div><dt className="inline text-muted">Licencia: </dt><dd className="inline">{s.license}</dd></div>
      </dl>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {s.cautions.map((c) => <li key={c}>{c}</li>)}
      </ul>
    </li>
  );
}

export default function SourcesPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Fuentes y atribución</h1>
      <p className="text-sm text-muted">
        LoL Hub combina varias fuentes gratuitas. Combinarlas no suma sus cuotas ni sus permisos de uso: cada proveedor mantiene los suyos.
        Información investigada el {SOURCES_RESEARCHED_ON}; revisa siempre los términos vigentes de cada proveedor.
      </p>

      <section aria-labelledby="reparto" className="space-y-2">
        <h2 id="reparto" className="text-xl font-semibold">Qué fuente responde cada dato</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <caption className="sr-only">Reparto de responsabilidades entre fuentes</caption>
            <thead className="bg-surface text-muted">
              <tr><th scope="col" className="px-3 py-2">Dato</th><th scope="col" className="px-3 py-2">Fuente</th><th scope="col" className="px-3 py-2">Nota</th></tr>
            </thead>
            <tbody>
              {RESPONSIBILITIES.map((r) => (
                <tr key={r.data} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 font-medium">{r.data}</th>
                  <td className="px-3 py-2">{getSource(r.source).name}</td>
                  <td className="px-3 py-2 text-muted">{r.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="detalle" className="space-y-2">
        <h2 id="detalle" className="text-xl font-semibold">Detalle por fuente</h2>
        <ul className="grid gap-3 md:grid-cols-2">{SOURCES.map((s) => <SourceCard key={s.id} s={s} />)}</ul>
      </section>

      <section aria-labelledby="descartada" className="space-y-2">
        <h2 id="descartada" className="text-xl font-semibold">Fuente no utilizada</h2>
        <p className="text-sm"><strong>{NOT_RECOMMENDED.name}:</strong> {NOT_RECOMMENDED.reason}</p>
      </section>

      <p className="border-t border-border pt-4 text-xs text-muted">{RIOT_DISCLAIMER}</p>
    </div>
  );
}
