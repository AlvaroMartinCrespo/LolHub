import type { TeamStats } from "@/lib/stats/formulas";
import type { ConsistencyReport } from "@/lib/stats/validate";
import { ConsistencyNote, FormStrip, SampleNotice, SplitBar, StatCard, pct } from "./parts";

interface Props {
  stats: TeamStats;
  consistency: ConsistencyReport;
  truncated?: boolean;
}

export function TeamStatsPanel({ stats, consistency, truncated }: Props) {
  return (
    <div className="space-y-4">
      <SampleNotice stats={stats} truncated={truncated} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Series ganadas" value={String(stats.series.wins)} />
        <StatCard label="Series perdidas" value={String(stats.series.losses)} />
        <StatCard label="% de victorias (series)" value={pct(stats.series.winRate)} detail={`${stats.sample.series} series`} />
        <StatCard label="% de victorias (mapas)" value={pct(stats.maps.winRate)} detail={`${stats.maps.wins} V · ${stats.maps.losses} D`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SplitBar label="Series" wins={stats.series.wins} losses={stats.series.losses} reliable={stats.reliable} />
        <SplitBar label="Mapas" wins={stats.maps.wins} losses={stats.maps.losses} reliable={stats.reliable} />
      </div>
      <div>
        <p className="mb-1 text-sm text-muted">Forma reciente (últimas 5 series)</p>
        <FormStrip form={stats.form} />
      </div>
      <ConsistencyNote report={consistency} />
    </div>
  );
}
