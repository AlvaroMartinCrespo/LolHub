import Link from "next/link";
import type { Standing } from "@/types/domain";
import { SafeImage } from "../ui/SafeImage";

export function StandingsTable({ standings }: { standings: Standing[] }) {
  const hasTies = standings.some((s) => (s.ties ?? 0) > 0);
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[26rem] text-left text-sm">
        <caption className="sr-only">Clasificación</caption>
        <thead className="bg-surface text-muted">
          <tr>
            <th scope="col" className="px-3 py-2">#</th>
            <th scope="col" className="px-3 py-2">Equipo</th>
            <th scope="col" className="px-3 py-2 text-right">V</th>
            <th scope="col" className="px-3 py-2 text-right">D</th>
            {hasTies && <th scope="col" className="px-3 py-2 text-right">E</th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.team.id} className="border-t border-border">
              <td className="px-3 py-2 tabular-nums">{s.rank ?? "–"}</td>
              <th scope="row" className="px-3 py-2 font-medium">
                <Link href={`/equipos/${s.team.id}`} className="flex items-center gap-2 hover:text-accent">
                  <SafeImage src={s.team.imageUrl} alt="" fallbackName={s.team.name} size={24} />
                  {s.team.name}
                </Link>
              </th>
              <td className="px-3 py-2 text-right tabular-nums">{s.wins ?? "–"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{s.losses ?? "–"}</td>
              {hasTies && <td className="px-3 py-2 text-right tabular-nums">{s.ties ?? "–"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
