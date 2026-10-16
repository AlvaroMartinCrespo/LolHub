import { LocalTime } from "../ui/LocalTime";

/** Aviso de datos desactualizados: se muestra cuando se sirven los últimos datos válidos (Paso 9). */
export function StaleNotice({
  lastUpdatedIso,
  sourceLabel,
  isStale = true,
}: {
  lastUpdatedIso: string | null;
  sourceLabel?: string;
  isStale?: boolean;
}) {
  const style = isStale
    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
    : "border-white/15 bg-white/5 text-white/75";

  return (
    <div role="status" className={`rounded-md border px-3 py-2 text-sm ${style}`}>
      {sourceLabel ? `Fuente: ${sourceLabel}` : "Datos posiblemente desactualizados"}
      {sourceLabel && isStale && <> · Datos posiblemente desactualizados</>}
      {lastUpdatedIso && (
        <>
          {" "}· {isStale ? "última copia válida" : "consultado"}: <LocalTime iso={lastUpdatedIso} />
        </>
      )}
    </div>
  );
}
