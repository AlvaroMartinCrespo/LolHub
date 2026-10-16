import { FreshnessNotice } from "@/components/states/FreshnessNotice";
import type { Metadata } from "next";
import Link from "next/link";
import type { Team } from "@/types/domain";
import { getTeam, getTeamHistory, searchTeams } from "@/lib/services/lol";
import { safe } from "@/lib/services/safe";
import { parseId } from "@/lib/params";
import { applyStatsFilters, buildStatsOptions, parseStatsFilters } from "@/lib/stats/filters";
import { computeTeamStats, MIN_SAMPLE, type TeamStats } from "@/lib/stats/formulas";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { StatsFilterForm } from "@/components/stats/StatsFilterForm";
import { TeamPicker } from "@/components/stats/TeamPicker";
import { computeHeadToHead } from "@/lib/stats/headToHead";
import { HeadToHeadPanel } from "@/components/stats/HeadToHeadPanel";
import { FormStrip, SampleNotice, pct } from "@/components/stats/parts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comparar equipos · LoL Hub" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function resolveSide(idRaw: string, q: string) {
  const id = parseId(idRaw);
  const team = id !== null ? await safe(() => getTeam(id)) : null;
  const candidates = q.trim() ? await safe(() => searchTeams(q.trim())) : null;
  return { team: team?.data ?? null, teamError: team?.error ?? null, candidates: candidates?.data?.items ?? (candidates ? [] : null), candError: candidates?.error ?? null };
}

export default async function Compare({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filters = parseStatsFilters(sp);
  const aRaw = one(sp.a), bRaw = one(sp.b), qa = one(sp.qa), qb = one(sp.qb);

  const [A, B] = await Promise.all([resolveSide(aRaw, qa), resolveSide(bRaw, qb)]);
  const [ha, hb] = await Promise.all([
    A.team ? safe(() => getTeamHistory(A.team!.id)) : null,
    B.team ? safe(() => getTeamHistory(B.team!.id)) : null,
  ]);

  const keep: Record<string, string> = {};
  if (A.team) keep.a = String(A.team.id);
  if (B.team) keep.b = String(B.team.id);
  const current = { ...keep, ...(filters.period !== "all" ? { period: filters.period } : {}) };

  return (
    <div className="space-y-6">
      <FreshnessNotice />
      <h1 className="text-2xl font-semibold">Comparar equipos</h1>
      <form method="get" action="/comparar" className="space-y-3">
        {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div className="grid gap-3 md:grid-cols-2">
          <TeamPicker slot="a" label="Equipo A" selected={A.team} query={qa} candidates={A.candidates} current={current} />
          <TeamPicker slot="b" label="Equipo B" selected={B.team} query={qb} candidates={B.candidates} current={current} />
        </div>
        <button type="submit" className="min-h-10 rounded-md border border-border bg-surface px-4 text-sm">Buscar equipos</button>
      </form>
      {(A.candError || B.candError) && <ErrorState message={A.candError ?? B.candError ?? ""} />}

      {!A.team || !B.team ? (
        <EmptyState title="Elige dos equipos" description="Busca por nombre y selecciona un equipo en cada lado para ver la comparativa." />
      ) : !ha?.data || !hb?.data ? (
        <ErrorState message={ha?.error ?? hb?.error ?? "No se pudo cargar el historial."} />
      ) : (
        (() => {
          const all = [...ha.data.matches, ...hb.data.matches];
          const sA = computeTeamStats(applyStatsFilters(ha.data.matches, filters), A.team.id);
          const sB = computeTeamStats(applyStatsFilters(hb.data.matches, filters), B.team.id);
          const comparable = sA.reliable && sB.reliable && !sA.mixedFormats && !sB.mixedFormats && sameFormats(sA, sB);
          return (
            <>
              <StatsFilterForm action="/comparar" hidden={keep} options={buildStatsOptions(all)} value={filters} />
              <Comparison a={A.team} b={B.team} sA={sA} sB={sB} comparable={comparable} />
              <HeadToHeadPanel a={A.team} b={B.team} h2h={computeHeadToHead(applyStatsFilters(all, filters), A.team.id, B.team.id)} />
            </>
          );
        })()
      )}
      <p className="text-sm text-muted">
        Las métricas se calculan con los últimos partidos cargados de cada equipo (máx. 300).{" "}
        <Link href="/competiciones" className="text-accent">Explorar competiciones</Link>
      </p>
    </div>
  );
}

const sameFormats = (a: TeamStats, b: TeamStats) =>
  Object.keys(a.formats).sort().join() === Object.keys(b.formats).sort().join();

function Comparison({ a, b, sA, sB, comparable }: { a: Team; b: Team; sA: TeamStats; sB: TeamStats; comparable: boolean }) {
  const rows: { label: string; va: string; vb: string; na: number | null; nb: number | null }[] = [
    { label: "Series (V–D)", va: `${sA.series.wins}–${sA.series.losses}`, vb: `${sB.series.wins}–${sB.series.losses}`, na: null, nb: null },
    { label: "% victorias (series)", va: pct(sA.series.winRate), vb: pct(sB.series.winRate), na: sA.series.winRate, nb: sB.series.winRate },
    { label: "Mapas (V–D)", va: `${sA.maps.wins}–${sA.maps.losses}`, vb: `${sB.maps.wins}–${sB.maps.losses}`, na: null, nb: null },
    { label: "% victorias (mapas)", va: pct(sA.maps.winRate), vb: pct(sB.maps.winRate), na: sA.maps.winRate, nb: sB.maps.winRate },
  ];
  const better = (x: number | null, y: number | null) => comparable && x !== null && y !== null && x > y;
  return (
    <section aria-labelledby="cmp" className="space-y-4">
      <h2 id="cmp" className="sr-only">Resultado de la comparativa</h2>
      {!comparable && (
        <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          No se resalta ventaja: hace falta al menos {MIN_SAMPLE} series por equipo y el mismo formato (al mejor de N) en ambos.
          Usa los filtros para igualar el formato y el periodo.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <caption className="sr-only">Comparativa de {a.name} y {b.name}</caption>
          <thead className="bg-surface text-muted">
            <tr><th scope="col" className="px-3 py-2">Métrica</th><th scope="col" className="px-3 py-2">{a.name}</th><th scope="col" className="px-3 py-2">{b.name}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <th scope="row" className="px-3 py-2 font-medium">{r.label}</th>
                <td className={`px-3 py-2 tabular-nums ${better(r.na, r.nb) ? "font-bold text-accent" : ""}`}>{r.va}</td>
                <td className={`px-3 py-2 tabular-nums ${better(r.nb, r.na) ? "font-bold text-accent" : ""}`}>{r.vb}</td>
              </tr>
            ))}
            <tr className="border-t border-border">
              <th scope="row" className="px-3 py-2 font-medium">Forma reciente</th>
              <td className="px-3 py-2"><FormStrip form={sA.form} /></td>
              <td className="px-3 py-2"><FormStrip form={sB.form} /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div><p className="mb-1 font-semibold">{a.name}</p><SampleNotice stats={sA} /></div>
        <div><p className="mb-1 font-semibold">{b.name}</p><SampleNotice stats={sB} /></div>
      </div>
    </section>
  );
}
