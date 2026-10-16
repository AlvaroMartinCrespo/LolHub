# Despliegue y actualización automática (Paso 9)

## 1. Vercel
1. Importa el repositorio en Vercel (framework detectado: Next.js; `vercel.json` ya incluido).
2. Variables de entorno (Project → Settings → Environment Variables), para *Production* y *Preview*:
   | Variable | Uso |
   |---|---|
   | `PANDASCORE_API_TOKEN` | Token de PandaScore. Solo servidor. Nunca `NEXT_PUBLIC_*`. |
   | `CRON_SECRET` | Aleatorio, ≥ 16 caracteres. Protege `/api/cron/*` y `/api/health`. |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Necesarias para snapshots, API de Oracle y reservar cuota CitoAPI. |
3. Despliega. Los datos se actualizan solos (ver §2); no hace falta redesplegar.

## 2. Estrategia de caché por tipo de dato
Definida en `src/lib/cache/revalidate.ts` (caché de datos de Next.js, compartida entre peticiones; el dato caduca y se renueva en la siguiente visita):

| Tipo | Revalidación | Uso |
|---|---|---|
| `running` | 30 s | Partidos en directo (solo útil si tu plan de PandaScore los incluye) |
| `detail` | 60 s | Ficha de partido (puede estar en directo) |
| `upcoming` | 5 min | Próximos partidos |
| `finished` | 1 h | Resultados recientes |
| `catalog` | 1 h | Ligas, torneos, equipos, jugadores, clasificaciones |
| `historical` | 24 h | Historial de equipo (base de las estadísticas) |
| `health` | sin caché | `/api/health` |

Ajusta los valores según tu cuota (el plan gratuito de PandaScore indicado en la documentación consultada: 1000 peticiones/hora).

## 3. Cron Jobs de Vercel (evaluación)
Fuente: documentación oficial «Managing Cron Jobs» de Vercel (consultada en el desarrollo de este paso).
- Los cron jobs están disponibles en todos los planes; en **Hobby solo pueden ejecutarse una vez al día**. Una expresión más frecuente hace fallar el despliegue en Hobby.
- Los horarios son UTC y los cron solo se ejecutan en despliegues de **producción**.
- Si existe `CRON_SECRET`, Vercel envía `Authorization: Bearer <CRON_SECRET>`; la ruta lo comprueba.
- Vercel puede entregar el mismo evento más de una vez → el proceso debe ser **idempotente**.
- No sigue redirecciones; la duración máxima es la de las funciones de tu plan.

Implementación: `/api/cron/warm` (06:00 UTC) precalienta PandaScore. Oracle's Elixir se importa manualmente desde Supabase Table Editor a `oracle_elixir_2025`; no se envía el archivo por Vercel ni se programa una descarga.
- Hobby: deja `"0 6 * * *"`.
- Pro/Enterprise: puedes cambiar a una frecuencia mayor (p. ej. `"*/10 * * * *"`) y redesplegar. No lo dejamos por defecto porque rompería el despliegue en Hobby. Comprueba límites vigentes en la documentación de Vercel antes de cambiarlo.

## 4. Base de datos opcional: Supabase
El hub principal funciona sin Supabase. Aplica `0007_match_results_archive.sql` para registrar resultados y habilitar `/archivo`; `0006_oracles_elixir_raw.sql` es para Oracle, `0003_source_snapshots.sql` para fallback PandaScore y `0005_citoapi_quota_guard.sql` para la cuota CitoAPI.

Para cargar Oracle 2025, abre `oracle_elixir_2025` en Table Editor → Insert → Import Data from CSV. El Dashboard documenta un límite de 100 MB por CSV; el plan Free incluye 500 MB de base de datos, y el tamaño almacenado puede superar al archivo. Comprueba el espacio libre antes de importar.

## 5. Últimos datos válidos y aviso «desactualizado»
Si PandaScore falla de forma transitoria (429, 5xx o red) tras los reintentos, se sirven los últimos datos válidos de esa misma consulta y la página muestra «Datos posiblemente desactualizados · última actualización: …».
- Errores 401/403/404 **no** se enmascaran.
- Sin Supabase, el respaldo vive en memoria de cada instancia (`src/lib/services/last-good.ts`, máx. 300 consultas, 24 h). Con Supabase, snapshots sobreviven al reciclado de instancias.
- Si no hay copia previa, se muestra el error normal de la sección.

## 6. Probar en producción
```bash
BASE_URL=https://tu-app.vercel.app CRON_SECRET=xxx PANDASCORE_API_TOKEN=xxx npm run check:prod
```
Comprueba: rutas sin errores 5xx, token ausente en las respuestas, rutas internas protegidas, `/api/health` (estado y cuota restante) y `/api/cron/warm` idempotente.
- **Errores de API**: en un despliegue *Preview* pon un token inválido y verifica el mensaje «Credenciales de la fuente de datos no válidas» (401), y sin token «no está configurado».
- **Límites de cuota**: `npm run check:prod -- --burst=30` lanza llamadas reales a PandaScore (consumen cuota); revisa `rateLimitRemaining` y los logs de Vercel. Un 429 se reintenta 3 veces con espera creciente (respeta `Retry-After`) y después se sirve el respaldo si existe.
- Logs de cron: pestaña *Cron Jobs* del proyecto en Vercel → *View Logs*.
