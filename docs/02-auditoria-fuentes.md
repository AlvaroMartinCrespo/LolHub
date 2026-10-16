# Auditoría de fuentes complementarias (Paso 12.3.1)

Mismo método que el Paso 1: documentación oficial → endpoints reales → muestras guardadas → qué hay, qué falta y qué límites aplican.
Documentación revisada el **16/10/2026**.

## Estado de la auditoría

| Fuente | Documentación revisada | Endpoints reales probados | Muestras en `docs/samples/` |
|---|---|---|---|
| CitoAPI | Sí | **No** (entorno de desarrollo sin acceso de red a `api.citoapi.com`) | Pendiente |
| Leaguepedia (Cargo) | Parcial: declaración pública de `Teams`; `Tenures` solo por ejemplo de consulta | **No** (sin acceso de red a `lol.fandom.com`) | Pendiente |
| Oracle's Elixir | Diccionario oficial (de 2019) y estructura de los CSV recientes según proyectos que los consumen | **No** (sin acceso de red; la URL de descarga actual no se pudo verificar) | Pendiente |

**Qué falta para cerrar la auditoría:** ejecutar en tu máquina, con tus claves, `npm run audit:sources` y completar la sección «Resultados reales» de este documento con `docs/samples/_report_sources.json`. Hasta entonces los adaptadores solo usan lo que la documentación muestra con ejemplo completo, y lo demás está marcado como pendiente.

```bash
npm run audit:sources                          # las tres fuentes
npm run audit:sources -- --only=leaguepedia    # una sola
npm run audit:sources -- --cito-budget=8       # límite de llamadas a CitoAPI en esta ejecución (por defecto 12)
npm run audit:sources -- --lp-delay=90         # segundos entre consultas a Leaguepedia (por defecto 65)
npm run audit:sources -- --oe-file=./2026_LoL_esports_match_data_from_OraclesElixir.csv
```

El script no imprime claves, respeta el presupuesto de llamadas de CitoAPI, espera entre consultas a Leaguepedia y se detiene si recibe el error de límite.
De Oracle's Elixir solo guarda la cabecera y 3 filas de muestra: los datos son de Oracle's Elixir/Riot y no se redistribuyen.

## CitoAPI

- Base: `https://api.citoapi.com/api/v1`. Autenticación: cabecera `x-api-key`. Envoltorio de respuestas: `{ "success": true, "data": … }`.
- Plan gratuito: 500 llamadas/mes (confirmar en el panel; sus páginas muestran precios y límites distintos).
- Estados de partido que documenta: `unstarted`, `inProgress`, `completed`. IDs de partido/mapa: cadenas estilo lolesports (p. ej. `115548128963037541`); equipos por *slug*; jugadores por UUID.
- **Con ejemplo de respuesta publicado (los únicos que implementa el adaptador):**
  - `GET /lol/matches/{id}/games` → `matchId`, `bestOf`, `score.team1/team2`, `games[].gameId/winner`.
  - `GET /lol/players/{id}/teams` → `playerId`, `playerName`, `teams[].teamSlug/teamName/role/startedAt/endedAt`.
- **Existen pero sin ejemplo de respuesta (pendientes de auditar):** `/lol/matches/{id}`, `/lol/players`, `/lol/players/{id}/stats`, `/lol/teams`, `/lol/teams/{slug}/roster/history`, `/lol/transfers`, `/lol/schedule/*`, `/lol/leagues`.
- Directo y webhooks: de planes de pago. La propia documentación avisa de que las estadísticas pueden completarse después de publicarse y de que los KDA a cero son provisionales hasta que la cobertura llega a `player_stats_full`.
- Aviso legal de CitoAPI: se declara agregador independiente, con datos de fuentes públicas que no son un feed oficial ni cuentan con derechos liberados. Revisar sus Términos antes de publicar.

## Leaguepedia (Cargo API)

- Endpoint: `https://lol.fandom.com/api.php?action=cargoquery&format=json&tables=…&fields=…&where=…`. Sin clave.
- Límite anónimo: informes de otros proyectos hablan de ≈1 consulta por minuto y 500 filas por página; con cuenta bot (`Special:BotPasswords`) las páginas son de 5.000 filas y el límite sube. **No verificado por nosotros.**
- El error de límite llega **dentro de un HTTP 200**: `{"error":{"code":"ratelimited","info":"…"}}`. El adaptador lo detecta y lo convierte en `rate_limited`; la gestión de esperas es el Paso 12.3.3.
- Campos usados (`LEAGUEPEDIA_FIELDS` en el adaptador):
  - `Teams`: `Name`, `OverviewPage`, `Short`, `Location`, `Region`, `Image`, `IsDisbanded` → **verificados** en la declaración pública `Module:CargoDeclare/Teams`.
  - `Tenures`: `Player`, `Team`, `IsCurrent` → verificados por un ejemplo oficial; `DateJoin`, `DateLeave`, `Role` → **pendientes** (el auditor llama a `cargofields` y lo comprueba).
- Cargo devuelve todos los valores como cadenas. `Image` es un **nombre de archivo**, no una URL; el adaptador no lo convierte en `imageUrl` (los logos son de cada equipo y no siempre comparten la licencia CC-BY-SA del texto). `leaguepediaFileUrl()` existe solo para usarlo con permiso.
- Licencia: CC-BY-SA → atribución obligatoria; revisar la cláusula de compartir igual para datos derivados.

## Oracle's Elixir

- No es una API: CSV anuales con **una fila por jugador (`participantid` 1–10) y una por equipo (100 azul / 200 rojo) por mapa**.
- El diccionario oficial publicado (2019) usa `player`, `team`, `k`, `d`, `a`, `dmgtochamps`, `patchno`; los CSV recientes usan `playername`, `teamname`, `kills`, `deaths`, `assists`, `damagetochampions`, `patch`, además de `playerid`, `teamid`, `datacomplete`. El diccionario avisa de que la estructura puede cambiar: el adaptador acepta ambos juegos de nombres y exige solo `gameid`, `participantid`, `side`, `result` y `gamelength`.
- **Unidad de `gamelength`:** el diccionario antiguo dice minutos con centésimas; los CSV recientes parecen usar segundos (no verificado). Es una opción explícita (`gameLengthUnit`, por defecto `seconds`); el adaptador marca como `suspicious_length` las duraciones fuera de 5–90 min en vez de corregirlas, y el auditor sugiere la unidad según la mediana.
- **Zona horaria de `date`:** no está documentada; por eso el modelo guarda solo `playedOn` (YYYY-MM-DD) y no un instante.
- `gameid` puede repetirse entre ligas (según el diccionario); por eso las consultas requieren también `league`. La tabla tiene alcance 2025.
- La URL de descarga actual no se fija en el código (no se pudo verificar): se pasa con `ORACLESELIXIR_CSV_URL` o `--oe-file`.
- Las estadísticas de partida son propiedad de Riot Games; revisar las condiciones de reutilización y atribuir.

## Adaptadores (`src/lib/sources/adapters/`)

| Archivo | Devuelve | Notas |
|---|---|---|
| `pandascore.ts` | Modelo del Paso 3 (`Match`, `Team`, `Player`, `League`, `Tournament`, `Standing`, `Page<T>`) + identidades | Envuelve `lol.ts`; consultas por visita permitidas |
| `citoapi.ts` | `ExternalSeries`, `TeamStint[]` | Solo los 2 endpoints documentados; sin reintentos (cada intento gasta cuota); `ctx` obligatorio |
| `leaguepedia.ts` | `ExternalTeam[]`, `TeamStint[]` | Detecta el error dentro del 200; sin reintentos; valores de `where` validados |
| `oracleselixir.ts` | `StatGame[]` (+ avisos) | Puro: recibe texto CSV; se usa para auditoría/normalización, no para la carga manual raw de producción |
| `base.ts` | Contrato `SourceAdapter`, `guardQuery`, `getJson` | `guardQuery` aplica `canQuery` (12.2) y lanza `DataSourceError("blocked")` |

Los tipos internos nuevos están en `src/types/sources.ts`. Los IDs externos son `string` (cada proveedor usa el suyo); cada dato lleva `meta: { source, fetchedAt }`.
Data Dragon (CDN estático) y la API de Riot (desactivada en 12.2) no tienen adaptador todavía.

## Avance 12.3.2

La migración `supabase/migrations/0003_source_snapshots.sql` crea almacenamiento privado de snapshots por `(source, cache_key)`, con `payload` y `updated_at`. El cliente PandaScore lo usa de forma opcional para recuperar una respuesta ante fallos transitorios si la instancia no tiene una copia en memoria. Los errores de Supabase no sustituyen el error de origen. La migración `0006_oracles_elixir_raw.sql` crea `oracle_elixir_2025`, que se carga manualmente desde el Dashboard y se lee por `gameid` y `league` en `/api/oracle/elixir`.

## Tabla de equivalencias de IDs (`src/lib/sources/equivalences.ts`)

- **ID canónico = ID de PandaScore.** Cada fuente se enlaza a él con una entrada `{ canonical, external, status, method, evidence, reviewedBy, reviewedAt }`.
- **No se fusiona por nombre sin revisar:** `suggestEquivalences` solo propone candidatos (nombre/siglas normalizados) y marca los ambiguos; una propuesta nunca resuelve nada. Solo las entradas `confirmed` resuelven, y confirmar exige revisor, fecha y evidencia.
- `validateEquivalences` impide contradicciones: un externo con dos canónicos, un canónico con dos externos de la misma fuente, pares duplicados, tipos distintos.
- Persistencia: `data/equivalences.json` (vacío: no se han inventado equivalencias) y la tabla `entity_equivalences` (`supabase/migrations/0002_entity_equivalences.sql`) con las mismas reglas como restricciones; RLS sin políticas.
- Flujo de trabajo: auditar → generar identidades de cada fuente (`teamIdentity`, `stintIdentities`, `gameIdentities`…) → `suggestEquivalences` → revisar a mano → `confirmEquivalence` → guardar.

## Resultados reales (rellenar tras `npm run audit:sources`)

| Fuente | Fecha | Endpoints OK | Campos que faltan | Límites observados | Notas |
|---|---|---|---|---|---|
| CitoAPI | — | — | — | — | — |
| Leaguepedia | — | — | — | — | — |
| Oracle's Elixir | — | — | — | — | — |
