import type { Metadata } from "next";
import { addDays, dayWindow, parseDay, todayUtc } from "@/lib/dates";
import { getMatchesBetween } from "@/lib/services/lol";
import { safe } from "@/lib/services/safe";
import { DayNavigator } from "@/components/calendar/DayNavigator";
import { DayView } from "@/components/calendar/DayView";
import { ErrorState } from "@/components/states/ErrorState";
import { FreshnessNotice } from "@/components/states/FreshnessNotice";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendario · LoL Hub" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ fecha?: string | string[] }> }) {
  const raw = (await searchParams).fecha;
  const day = parseDay(Array.isArray(raw) ? raw[0] : raw) ?? todayUtc();
  const { from, to } = dayWindow(day);
  // Días pasados: caché larga; hoy y futuro: caché corta.
  const kind = day < addDays(todayUtc(), 0) ? "historical" : "upcoming";
  const loaded = await safe(() => getMatchesBetween(from, to, kind));

  return (
    <section aria-labelledby="cal" className="space-y-5">
      <FreshnessNotice />
      <h1 id="cal" className="text-2xl font-semibold">Calendario por día</h1>
      <DayNavigator day={day} />
      {loaded.error || !loaded.data ? (
        <ErrorState message={loaded.error ?? "No se pudieron cargar los partidos."} />
      ) : (
        <>
          <DayView matches={loaded.data.matches} day={day} />
          {loaded.data.truncated && (
            <p className="text-sm text-amber-300">Se cargaron los primeros 200 partidos de la ventana; puede faltar alguno.</p>
          )}
        </>
      )}
      <p className="text-sm text-muted">Las horas y el recorte del día usan la zona horaria de tu navegador.</p>
    </section>
  );
}
