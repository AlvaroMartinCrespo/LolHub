import { FreshnessNotice } from "@/components/states/FreshnessNotice";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Match, Team } from "@/types/domain";
import { DataSourceError } from "@/lib/services/errors";
import { getMatch, getTeam } from "@/lib/services/lol";
import { ErrorState } from "@/components/states/ErrorState";
import { MatchHeader } from "@/components/match/MatchHeader";
import { CalendarExport } from "@/components/match/CalendarExport";
import { GamesList } from "@/components/match/GamesList";
import { RosterSection, type TeamRoster } from "@/components/match/RosterSection";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const parseId = (raw: string): number | null => (/^\d{1,12}$/.test(raw) ? Number(raw) : null);

async function loadMatch(id: number): Promise<Match> {
  try {
    return await getMatch(id);
  } catch (e) {
    if (e instanceof DataSourceError && e.kind === "not_found") notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const id = parseId((await params).id);
  if (id === null) return { title: "Partido no encontrado · LoL Hub" };
  try {
    const m = await getMatch(id);
    return { title: `${m.name} · LoL Hub` };
  } catch {
    return { title: "Partido · LoL Hub" };
  }
}

export default async function MatchPage({ params }: Params) {
  const id = parseId((await params).id);
  if (id === null) notFound();

  let match: Match;
  try {
    match = await loadMatch(id);
  } catch (e) {
    const message = e instanceof DataSourceError ? e.userMessage : "Error inesperado.";
    return (
      <div className="space-y-4">
        <ErrorState message={message} />
        <Link href="/" className="text-accent">← Volver al inicio</Link>
      </div>
    );
  }

  const rosters: TeamRoster[] = match.sides
    ? await Promise.all(
        match.sides.map(async (s): Promise<TeamRoster> => {
          let team: Team | null = null;
          try {
            team = await getTeam(s.team.id);
          } catch {
            team = null;
          }
          return { teamId: s.team.id, teamName: s.team.name, team };
        }),
      )
    : [];

  return (
    <div className="space-y-8">
      <FreshnessNotice />
      <nav aria-label="Migas de pan"><Link href="/" className="text-sm text-accent">← Inicio</Link></nav>
      <MatchHeader match={match} />
      {match.startTime && (match.status === "scheduled" || match.status === "postponed") && <CalendarExport matchId={match.id} />}
      <GamesList match={match} />
      {rosters.length > 0 && <RosterSection rosters={rosters} />}
      <section aria-labelledby="stats" className="space-y-2">
        <h2 id="stats" className="text-xl font-semibold">Estadísticas</h2>
        <p className="text-sm text-muted">
          Se muestran únicamente los datos que proporciona la fuente: marcador, ganador y duración por mapa.
          Las estadísticas detalladas por jugador no están incluidas.
        </p>
      </section>
    </div>
  );
}
