# Despliegue y actualización automática (Paso 9)

## 1. Vercel
1. Importa el repositorio en Vercel (framework detectado: Next.js; `vercel.json` ya incluido).
2. Variables de entorno (Project → Settings → Environment Variables), para *Production* y *Preview*:
   | Variable | Uso |
   |---|---|
   | `PANDASCORE_API_TOKEN` | Token de PandaScore. Solo servidor. Nunca `NEXT_PUBLIC_*`. |
   | `CRON_SECRET` | Aleatorio, ≥ 16 caracteres. Protege `/api/cron/warm` y `/api/health`. |
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

Implementación: `/api/cron/warm` (diario a las 06:00 UTC, `vercel.json`) solo **lee** ligas, directos, próximos y recientes para precalentar la caché; ejecutarlo varias veces no cambia nada. Como la caché ya se renueva con las visitas (§2), el cron es un apoyo, no un requisito.
- Hobby: deja `"0 6 * * *"`.
- Pro/Enterprise: puedes cambiar a una frecuencia mayor (p. ej. `"*/10 * * * *"`) y redesplegar. No lo dejamos por defecto porque rompería el despliegue en Hobby. Comprueba límites vigentes en la documentación de Vercel antes de cambiarlo.

## 4. Base de datos: no incluida (decisión)
No hace falta para la primera versión: los datos se leen de PandaScore con caché. Se añadiría solo si:
- necesitas historial propio más allá de lo que expone PandaScore,
- o quieres que el respaldo de «últimos datos válidos» sobreviva a reinicios y se comparta entre instancias.
En ese caso: guardar con *upsert* por `id` y `updated_at` de PandaScore (operación idempotente) desde el cron.

## 5. Últimos datos válidos y aviso «desactualizado»
Si PandaScore falla de forma transitoria (429, 5xx o red) tras los reintentos, se sirven los últimos datos válidos de esa misma consulta y la página muestra «Datos posiblemente desactualizados · última actualización: …».
- Errores 401/403/404 **no** se enmascaran.
- El respaldo vive en memoria de cada instancia (`src/lib/services/last-good.ts`, máx. 300 consultas, 24 h): es *best effort* en serverless. Para persistencia real, ver §4.
- Si no hay copia previa, se muestra el error normal de la sección.

## 6. Probar en producción
```bash
BASE_URL=https://tu-app.vercel.app CRON_SECRET=xxx PANDASCORE_API_TOKEN=xxx npm run check:prod
```
Comprueba: rutas sin errores 5xx, token ausente en las respuestas, rutas internas protegidas, `/api/health` (estado y cuota restante) y `/api/cron/warm` idempotente.
- **Errores de API**: en un despliegue *Preview* pon un token inválido y verifica el mensaje «Credenciales de la fuente de datos no válidas» (401), y sin token «no está configurado».
- **Límites de cuota**: `npm run check:prod -- --burst=30` lanza llamadas reales a PandaScore (consumen cuota); revisa `rateLimitRemaining` y los logs de Vercel. Un 429 se reintenta 3 veces con espera creciente (respeta `Retry-After`) y después se sirve el respaldo si existe.
- Logs de cron: pestaña *Cron Jobs* del proyecto en Vercel → *View Logs*.
