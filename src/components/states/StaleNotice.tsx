import { LocalTime } from "../ui/LocalTime";

/** Aviso de datos desactualizados: se muestra cuando se sirven los últimos datos válidos (Paso 9). */
export function StaleNotice({ lastUpdatedIso }: { lastUpdatedIso: string | null }) {
  return (
    <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
      Datos posiblemente desactualizados
      {lastUpdatedIso && (
        <>
          {" "}· última actualización: <LocalTime iso={lastUpdatedIso} />
        </>
      )}
    </div>
  );
}
