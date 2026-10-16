# LoL Hub
Hub de League of Legends sobre la API de PandaScore: calendario, resultados, fichas de partido, equipos, jugadores, competiciones, estadísticas y comparador.
Next.js 15 (App Router) + TypeScript + Tailwind CSS 3, listo para Vercel, tema oscuro por defecto.

## Instalación
Requisitos: Node.js ≥ 20.6 y un token de PandaScore.
```bash
npm install
cp .env.example .env     # edita PANDASCORE_API_TOKEN (y CRON_SECRET si usarás rutas internas)
npm run audit            # opcional pero recomendado: guarda respuestas reales en docs/samples
npm run dev              # http://localhost:3000
```

## Configuración
| Variable | Obligatoria | Uso |
|---|---|---|
| `PANDASCORE_API_TOKEN` | Sí | Token de PandaScore. Solo servidor; nunca `NEXT_PUBLIC_*`. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | No para el hub base | Requeridas para snapshots, archivo histórico, Oracle y control de cuota CitoAPI. Solo servidor; la service role key salta RLS. |
| `CITOAPI_KEY` | No (Paso 12) | CitoAPI opcional para huecos puntuales. Solo servidor; requiere Supabase para controlar cuota. |
| `ORACLESELIXIR_CSV_URL` | No (auditoría) | URL opcional para el script de auditoría; los datos de producción se importan desde Supabase Table Editor. |
| `CRON_SECRET` | Para `/api/cron/*` y `/api/health` | Aleatorio, ≥ 16 caracteres. |

## Scripts
| Comando | Acción |
|---|---|
| `npm run dev` / `build` / `start` | Desarrollo, compilación y producción |
| `npm run lint` | Comprobación de tipos (`tsc --noEmit`) |
| `npm test` | Pruebas unitarias, de integración y de accesibilidad (Vitest) |
| `npm run verify:token` | Comprueba que el token no aparece en el build ni en las páginas |
| `npm run audit` | Audita la API de PandaScore (Paso 1) |
| `npm run audit:sources` | Audita CitoAPI, Leaguepedia y Oracle's Elixir (Paso 12.3.1) |
| `npm run check:prod` | Comprobaciones sobre un despliegue real |

## Despliegue
Vercel: importa el repositorio, define las variables de entorno y despliega (`vercel.json` incluido). Guía completa, caché, cron y pruebas en producción: `docs/despliegue.md`.

## Documentación
- `docs/01-auditoria-pandascore.md` — auditoría de la API (Paso 1)
- `docs/estadisticas.md` — fórmulas y criterios de fiabilidad
- `docs/despliegue.md` — Vercel, caché, cron y datos de reserva
- `docs/calidad.md` — pruebas, accesibilidad, rendimiento y revisión responsive
- `docs/fuentes-datos.md` — fuentes gratuitas, límites, licencias y esquema Supabase (Paso 12)
- `docs/02-auditoria-fuentes.md` — auditoría de CitoAPI, Leaguepedia y Oracle's Elixir, adaptadores y equivalencias de IDs (Paso 12.3.1)
- `docs/segunda-etapa.md` — favoritos, calendario por día, H2H, récords, buscador, Worlds/MSI, .ics y panel de frescura

## Progreso
- [x] Paso 1 — Auditoría de la API (`docs/01-auditoria-pandascore.md`, `npm run audit`)
- [x] Paso 2 — Base técnica
- [x] Paso 3 — Capa de datos
- [x] Paso 4 — Componentes reutilizables
- [x] Paso 5 — Inicio: calendario y resultados
- [x] Paso 6 — Ficha del partido
- [x] Paso 7 — Equipos, jugadores y competiciones
- [x] Paso 8 — Estadísticas y comparativas
- [x] Paso 9 — Actualización automática y despliegue
- [x] Paso 10 — Calidad final
- [x] Paso 11 — Segunda etapa (opcional)
- [~] Paso 12 — Varias fuentes (coste 0 €): 12.1–12.3.1 hechos; 12.3.2–12.3.3 en progreso (snapshots, importación Oracle, caché y control de cuota); 12.4–12.5 parciales → `docs/fuentes-datos.md`, `docs/02-auditoria-fuentes.md`

## Puesta en marcha (histórico del Paso 2)
```bash
cp .env.example .env   # PANDASCORE_API_TOKEN=tu_token
npm install
npm run audit          # guarda respuestas reales en docs/samples
# CRON_SECRET en .env solo hace falta para /api/cron/warm y /api/health
npm run dev
```

## Estructura
- `src/app` rutas y layout (tema oscuro por defecto, responsive)
- `src/components` componentes: `MatchCard`, `TeamCard`, `PlayerCard`, `TeamBadge`, `filters/` (`MultiSelect`, `DateFilter`), `states/` (`Skeleton`, `EmptyState`, `ErrorState`, `StaleNotice`), `ui/` (`SafeImage`, `LocalTime`, `StatusBadge`); todo exportado desde `src/components/index.ts`
- `src/types` tipos de la API (`pandascore.ts`) y modelo interno (`domain.ts`)
- `src/lib/services` cliente de PandaScore con reintentos (`pandascore-client.ts`), errores tipados (`errors.ts`) y servicios LoL (`lol.ts`)
- `src/lib/schemas` validación zod del formato externo
- `src/lib/transform` normalización de datos (Paso 3)
- `src/lib/config` entorno y token (`server-only`)
- `src/lib/cache` tiempos de revalidación

## Seguridad
El token vive en `PANDASCORE_API_TOKEN`, se lee solo en módulos con `server-only` y nunca se usa `NEXT_PUBLIC_*`.

## Capa de datos (Paso 3)
- Servicios (solo servidor): ligas, torneos próximos, partidos próximos / en directo / recientes, detalle de partido, equipo y jugador (`src/lib/services/lol.ts`).
- Validación con zod elemento a elemento: los inválidos se descartan y se cuentan (`Page.skipped`).
- Normalización a modelo interno (`src/types/domain.ts`): fechas ISO UTC, estados (`scheduled|live|finished|postponed|canceled|unknown`), marcador por serie y resultado por mapa.
- Errores 401/403/404/429/5xx/red/formato → `DataSourceError` con `userMessage`; reintentos progresivos (3 intentos, 500 ms ×2, respeta `Retry-After`) solo en 429, 5xx y red.
- Caché con `next.revalidate` por tipo de dato (`src/lib/cache/revalidate.ts`).

## Limitaciones
- Los esquemas zod se basan en el modelo documentado de PandaScore, no en respuestas reales guardadas (requieren tu token). Tras `npm run audit`, contrasta `src/lib/schemas/pandascore.ts` con `docs/samples/*.json` y corrige diferencias.
- Los parámetros de ordenación/filtro (`sort=scheduled_at`, `-end_at`) deben confirmarse con la API real.
- Verificado: compilación TypeScript y build; transformaciones probadas con datos sintéticos desechables. No se probó contra la API real ni hay tests automatizados aún (Paso 10).
- El aviso «desactualizado» y los últimos datos válidos se implementaron en el Paso 9.

## Componentes (Paso 4)
- Reciben tipos del modelo interno (`src/types/domain.ts`), nunca el formato de PandaScore.
- `SafeImage`: tamaño reservado, `loading="lazy"`, texto alternativo y fallback de iniciales si falta o falla la imagen.
- `LocalTime`: muestra la hora en la zona horaria del navegador.
- `MultiSelect`: «Todas» (sin filtro) y «Restablecer»; navegable por teclado (Escape cierra).
- `MatchCard`: marcador de serie y resultado de cada mapa por separado; estados programado/directo/finalizado/aplazado/cancelado.
- Sin datos de ejemplo en la interfaz: los componentes se alimentan en el Paso 5.

### Limitaciones del Paso 4
- Se usa `<img>` y no `next/image` porque los hosts de imágenes no están verificados (requiere `npm run audit`). Revisa además los permisos de uso de logos.
- Los valores de `role` de jugador se muestran tal como llegan de la API; no hay mapeo hasta ver respuestas reales.
- `href` de las tarjetas es opcional: las rutas de ficha llegan en los Pasos 6–7.
- Verificado: TypeScript, build y renderizado servidor con datos sintéticos desechables. Sin tests automatizados aún (Paso 10); accesibilidad pendiente de revisión completa.

## Inicio (Paso 5)
- `src/app/page.tsx` (servidor) carga en paralelo partidos en directo + próximos y resultados recientes (100 cada uno); cada sección gestiona su propio error con botón «Reintentar».
- **Próximos**: directos primero y luego orden cronológico; filtros de liga y región (multiselección con «Todas» y restablecer) y fecha (hoy, próximos 7 días, día concreto del calendario). Los días se calculan en la zona horaria local.
- **Resultados**: filtros de liga, equipo, torneo y periodo (7/30/90 días); orden del más reciente al más antiguo.
- Estados mostrados: programado, en directo, finalizado, aplazado, cancelado (y desconocido). Marcador de serie y resultado de cada mapa por separado (`MatchCard`).
- Búsqueda rápida con debounce de 250 ms (sin tildes ni mayúsculas) sobre equipos, liga, torneo y serie; afecta a ambas secciones.
- Lógica pura de filtrado/orden en `src/lib/filters/matches.ts`.

### Limitaciones del Paso 5
- **Región**: la API no se ha verificado con respuestas reales. Se usa el campo `location` de cada equipo (valor crudo, p. ej. un código de país) como «región»; no hay agrupación por regiones competitivas (LEC, LCK…) hasta confirmar los datos.
- Se filtra en el navegador sobre las últimas 100 entradas por sección; «periodo» y las opciones de filtro solo reflejan lo cargado, no todo el histórico.
- Si falla la consulta de partidos en directo, se muestran igualmente los próximos (sin aviso específico).
- `sort=scheduled_at` / `-end_at` y la estructura de campos están por confirmar con `npm run audit`.
- Verificado: TypeScript, build y pruebas puntuales de la lógica de filtros con datos sintéticos desechables. No probado contra la API real ni en navegador; sin tests automatizados aún (Paso 10).
- Las tarjetas del inicio ya enlazan a `/partidos/[id]`.

## Ficha del partido (Paso 6)
Ruta `/partidos/[id]` (`src/app/partidos/[id]/`), con carga (`loading.tsx`), 404 (`not-found.tsx`) y error de la fuente de datos con mensaje claro.
- Cabecera (`MatchHeader`): equipos con logo y enlace, marcador de la **serie**, estado, inicio/fin en hora local, torneo/fase, formato (al mejor de N) y aviso de incomparecencia.
- Mapas (`GamesList`): tabla con el resultado de **cada mapa** (estado, ganador, duración, inicio), separada del marcador de serie.
- Plantillas (`RosterSection`): jugadores de cada equipo con enlace a su ficha.
- Estadísticas: solo lo que da la fuente (ganador y duración por mapa); se indica que no hay estadísticas detalladas.
- Caché de ficha: 60 s (`REVALIDATE.detail`).

### Limitaciones del Paso 6
- La «alineación» mostrada es la **plantilla actual del equipo** (`/lol/teams/{id}`), no la que jugó el partido: no hay un campo verificado de alineación por partido. Está indicado en pantalla.
- «Fase» = nombre del torneo que devuelve la API; no se ha verificado un campo de fase/ronda aparte.
- Duración mostrada solo si la API la envía (segundos → mm:ss).
- Los enlaces a `/equipos/[id]` y `/jugadores/[id]` ya funcionan (Paso 7).
- Esquema de `games`/`opponents` basado en el modelo documentado, no en respuestas reales guardadas (ejecutar `npm run audit`).
- Verificado: TypeScript, build y renderizado servidor con datos sintéticos desechables. No probado contra la API real ni en navegador; sin tests automáticos aún (Paso 10).

## Equipos, jugadores y competiciones (Paso 7)
Rutas (renderizadas en servidor, con `loading.tsx` y `not-found.tsx`):
- `/equipos/[id]`: logo, siglas, región, plantilla (enlaces a jugadores), próximos partidos y resultados/historial paginado (`?page=`).
- `/jugadores/[id]`: foto, nombre, equipo (enlace), rol, país/región, estado, y partidos recientes de su equipo.
- `/competiciones`: índice de ligas **construido desde la API** (paginado, sin lista fija).
- `/ligas/[id]`: torneos/fases (más recientes primero), calendario y resultados paginados.
- `/torneos/[id]`: fechas, nivel, clasificación (si la API la ofrece), calendario y resultados.
- Enlaces cruzados: partido → liga/torneo/equipos → jugadores → equipo; clasificación → equipos; menú «Competiciones».
- Cada sección secundaria falla de forma independiente (aviso sin romper la página); una entidad principal inexistente da 404.

### Limitaciones del Paso 7
- Los filtros `filter[opponent_id]`, `filter[league_id]`, `filter[tournament_id]` y los endpoints `/lol/tournaments/{id}/standings` y `/lol/tournaments?filter[league_id]=` se basan en la documentación general de PandaScore y **no se han probado con respuestas reales**; si alguno no existe en tu plan, la sección mostrará un aviso. Confirmar con `npm run audit`.
- **Jugador**: la fuente verificada no da historial de equipos ni partidos por jugador; se muestran los partidos del equipo actual (indicado en pantalla) y un aviso de historial no disponible.
- **Historial de equipo** = resultados paginados (más recientes primero); no hay historial de plantillas.
- **Clasificación**: puede no existir en torneos de eliminatoria (estado vacío explicativo). Solo V/D/E tal cual vienen de la API (el % de victorias está en las estadísticas del Paso 8).
- «Región» de jugador = país/nacionalidad que informa la API (valor crudo).
- Verificado: TypeScript, build y arranque con todas las rutas sin token (mensaje «no configurado», «no encontrado» para ids inválidos). No probado con datos reales ni en navegador; sin tests automáticos aún (Paso 10).
- En «no encontrado» la respuesta HTTP puede ser 200 por el streaming de `loading.tsx` (comportamiento de Next).

## Estadísticas y comparativas (Paso 8)
- `/equipos/[id]/estadisticas`: series V–D y % de victorias, mapas V–D y % de victorias, forma reciente (últimas 5), con filtros de periodo, temporada/serie, torneo y formato (formulario GET, funciona sin JavaScript).
- `/comparar`: comparativa lado a lado de dos equipos (buscador por nombre), con los mismos filtros.
- Fórmulas documentadas en `docs/estadisticas.md` e implementadas en `src/lib/stats/` (`formulas.ts`, `filters.ts`, `validate.ts`).
- Siempre se muestran periodo y tamaño de muestra, y los partidos excluidos (incomparecencia, sin ganador, no finalizados).
- Gráficos (barras V/D) solo con muestra fiable (≥ 10 series); la comparativa solo resalta ventaja con muestra suficiente y mismo formato en ambos equipos. Formatos mezclados generan aviso.
- Validación de cálculos contra los datos de origen: `V + D` = series contadas y, por serie, marcador = mapas ganados (resultado visible en pantalla).

### Limitaciones del Paso 8
- Muestra = últimos 300 partidos de cada equipo (3 llamadas de 100); se avisa si puede haber más historial. No hay estadísticas de toda la historia.
- Filtro por **rol** y estadísticas por jugador (KDA, etc.) no implementados: la fuente verificada no los proporciona (requieren plan histórico de pago, por confirmar con `npm run audit`).
- «Temporada» = nombre de la serie y «torneo» = nombre del torneo que devuelve la API; no se ha verificado un campo de año/temporada separado.
- `search[name]` (buscador de equipos) y `filter[opponent_id]` se basan en la documentación general; no probados con respuestas reales.
- Solo Queue, MMR y LP: pendientes como integración futura con la API de Riot.
- Verificado: TypeScript, build, rutas sin token y las fórmulas, filtros y validación con datos sintéticos desechables (resultados coincidentes con el cálculo manual). Sin tests automáticos aún (Paso 10) ni prueba con la API real.

## Actualización automática y despliegue (Paso 9)
Guía completa en `docs/despliegue.md`.
- **Vercel**: `vercel.json` incluido; variables `PANDASCORE_API_TOKEN` y `CRON_SECRET` (ver `.env.example`).
- **Caché por tipo de dato** (`src/lib/cache/revalidate.ts`): directos 30 s, ficha 60 s, próximos 5 min, resultados/catálogo 1 h, historial 24 h; los datos se renuevan sin redesplegar.
- **Cron**: `/api/cron/warm` (06:00 UTC) precalienta PandaScore con `CRON_SECRET`.
- **Oracle's Elixir**: importa el CSV desde Table Editor a `oracle_elixir_2025` (requiere migración `0006_oracles_elixir_raw.sql`); consulta filas por mapa en `/api/oracle/elixir?gameid=...&league=...`.
- **Base de datos**: Supabase opcional; aplica también `0007_match_results_archive.sql` para guardar los resultados consultados y habilitar `/archivo`.
- **Datos de reserva**: si PandaScore falla (429/5xx/red) tras 3 reintentos, se sirven los últimos datos válidos en memoria o, si está configurado, desde Supabase (`source_snapshots`, migración `0003_source_snapshots.sql`); la interfaz muestra fuente, fecha y aviso de obsolescencia. 401/403/404 no se enmascaran.
- **Salud**: `/api/health` (estado de PandaScore y cuota restante, protegido).
- **Pruebas en producción**: `npm run check:prod` (ver `docs/despliegue.md`).

### Limitaciones del Paso 9
- Sin Supabase configurado, el respaldo de «últimos datos válidos» está en memoria de cada instancia serverless y se pierde al reciclarla. Con Supabase, snapshots se comparten entre instancias.
- El cron diario es solo apoyo; la frescura real la dan los tiempos de revalidación al visitar la web. Frecuencias mayores requieren Vercel Pro (comprobar límites vigentes antes de cambiar `vercel.json`).
- Datos en directo reales dependen de que tu plan de PandaScore los incluya (por verificar con `npm run audit`).
- Verificado: TypeScript, build, rutas protegidas (401/503), lógica de reintentos y datos de reserva con `fetch` simulado (500, red, 401, sin copia previa) y el script `check:prod` contra un servidor local sin token (las comprobaciones contra PandaScore fallan ahí, como se espera). **No** se ha probado en Vercel ni contra la API real (requiere tu token y despliegue); las pruebas de errores y cuota en producción están descritas pero debes ejecutarlas tú. 

## Calidad final (Paso 10)
Detalle en `docs/calidad.md`.
- **159 pruebas automáticas** (9 archivos): filtros, fechas, marcadores, agregaciones, integración de servicios de API (errores, reintentos, paginación, datos de reserva), componentes, teclado, debounce, contraste WCAG AA y seguridad del token. Todas pasan.
- **Accesibilidad**: axe-core sin violaciones en componentes clave y portada; enlace «Saltar al contenido»; foco devuelto al cerrar filtros con Escape.
- **Token**: `npm run verify:token` no encuentra el secreto en `.next` ni en las respuestas HTML.

### Limitaciones del Paso 10
- **No se probó en móvil, tablet y escritorio reales** ni en un navegador: el entorno no dispone de uno. La revisión responsive es por código y queda una lista manual en `docs/calidad.md`. Tampoco se midió rendimiento (Lighthouse).
- La accesibilidad automática no sustituye una prueba con lector de pantalla; el contraste se calcula con la paleta, no sobre imágenes reales.
- Las pruebas de integración usan `fetch` simulado con datos sintéticos; **no se ha probado contra la API real de PandaScore** (requiere tu token). Los esquemas zod siguen pendientes de contrastarse con `docs/samples` tras `npm run audit`.
- Las pruebas en producción (errores reales de API, cuota) deben ejecutarlas tú con `npm run check:prod`.

## Segunda etapa (Paso 11)
Detalle en `docs/segunda-etapa.md`. Incluye: favoritos en el navegador, calendario por día, enfrentamientos directos en el comparador, récords de temporada, buscador global, página de Worlds/MSI, exportación `.ics` con recordatorio y panel de frescura (`/estado`).
- 48 pruebas nuevas (lógica pura, servicios con `fetch` simulado y componentes con axe). Total: 159, todas pasan. `npm run verify:token` sigue sin encontrar el secreto en el build ni en las páginas.
- Una prueba detectó un fallo real durante el desarrollo (recordatorio por defecto mal interpretado cuando faltaba el parámetro) y quedó corregido.

### Limitaciones del Paso 11
- No probado contra la API real ni en navegador/dispositivos reales: los endpoints y parámetros nuevos (`/lol/matches` con `range[scheduled_at]`, `search[name]`) están por confirmar con tu token.
- Worlds/MSI se detectan por nombre de liga; si la API usa otros nombres, la página lo indicará con un estado vacío.
- La hora de fin de los eventos `.ics` es una estimación de 2 h; los recordatorios son los del calendario del usuario (sin notificaciones push).
- Favoritos solo de equipos y solo en este navegador.
