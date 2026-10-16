# Fuentes de datos (Paso 12.1)

Investigado el 15/10/2026. Código: `src/lib/sources/catalog.ts` (fuente única de verdad). Página pública: `/fuentes`.
Combinar fuentes **no suma sus cuotas ni sus permisos de uso**.

| Fuente | Plan gratuito | Se usa para | Límites y cautelas |
|---|---|---|---|
| PandaScore Free | 1.000 peticiones/hora | Principal: partidos, resultados, ligas, equipos, jugadores | Sin estadísticas post-partido (plan Historical, de pago) |
| CitoAPI Free | 500 llamadas/mes | Huecos puntuales (stats de jugador, rosters, fichajes) | ≈16/día; sin directo ni webhooks; nunca por visita |
| Oracle's Elixir | CSV gratuitos | Histórico por partida (KDA, oro, daño, visión, campeones) | Archivos, no API; datos de Riot: seguir sus políticas y atribuir |
| Leaguepedia (Cargo) | Gratuita, sin clave | Rosters, historial de equipos, torneos, logos | CC-BY-SA; error de límite dentro de un HTTP 200 |
| Data Dragon | Gratuita, sin límite | Imágenes y nombres de campeones, objetos, runas | Solo datos estáticos |
| API de Riot | Gratuita con clave | Futuro: Solo Queue, ranked, LP | No cubre calendario profesional |

No se usa la API de lolesports de Riot: no está documentada y su clave pública cambia sin aviso.

## Base de datos: Supabase
- Migración: `supabase/migrations/0001_data_sources.sql` (ejecútala en el SQL Editor de Supabase o con la CLI `supabase db push`).
- Tablas: `data_sources` (catálogo) y `source_quota_usage` (contador por fuente y periodo; función atómica `bump_source_quota`).
- RLS activado **sin políticas**: solo accede el servidor con `SUPABASE_SERVICE_ROLE_KEY`. Esa clave nunca va al navegador ni a `NEXT_PUBLIC_*`.
- Convención para las tablas de datos de 12.3: columnas `source` (id de `data_sources`) y `updated_at`.
- Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (opcionales: sin ellas la web sigue funcionando solo con PandaScore), `CITOAPI_KEY`, `RIOT_API_KEY`.

## Reparto de responsabilidades (12.2)
Código: `src/lib/sources/routing.ts`. Cada tipo de dato tiene una única fuente, un modo de entrega y reglas:

| Dato | Fuente | Modo | ¿Por visita? | Caché mín. | Si falla |
|---|---|---|---|---|---|
| Calendario, resultados, equipos, jugadores, torneos | PandaScore | API en vivo | Sí | la del Paso 9 | Último dato válido + aviso |
| Estadísticas históricas por partida | Oracle's Elixir | Importación a Supabase | No | — | Omitir y marcar como ausente |
| Rosters, historial de equipos, logos | Leaguepedia | API con caché larga | No | 1 día | Último dato válido + aviso |
| Imágenes y datos de campeones | Data Dragon | CDN estático | Sí | 1 día | Omitir y marcar como ausente |
| Huecos puntuales | CitoAPI | Bajo demanda, si la cuota lo permite | No | 7 días | Omitir y marcar como ausente |
| Solo Queue / ranked | API de Riot | Futuro (desactivado) | No | — | — |

`canQuery(kind, { perVisit })` rechaza las llamadas prohibidas (por visita a fuentes limitadas, o a integraciones no activas). Los adaptadores de 12.3 deben pasar por ahí.

## Adaptadores y equivalencias (12.3.1)
Detalle completo, formatos y estado de verificación: `docs/02-auditoria-fuentes.md`.
- Adaptadores en `src/lib/sources/adapters/` (`pandascore`, `citoapi`, `leaguepedia`, `oracleselixir`), todos con el contrato `SourceAdapter` y la política de 12.2 (`guardQuery`). Modelo interno nuevo en `src/types/sources.ts`.
- Auditoría: `npm run audit:sources` (CitoAPI con presupuesto de llamadas, Leaguepedia con espera entre consultas, Oracle's Elixir desde CSV).
- Equivalencias de IDs: `src/lib/sources/equivalences.ts`, `data/equivalences.json` y migración `0002_entity_equivalences.sql`. El ID canónico es el de PandaScore y solo lo **confirmado por una persona** resuelve.
- Variables nuevas: `ORACLESELIXIR_CSV_URL` (opcional; URL https o ruta del CSV).

## Estado
- Hecho (12.1 y 12.2): catálogo, reparto de responsabilidades con reglas ejecutables, página de atribución con aviso de Riot, esquema Supabase, variables de entorno, pruebas.
- Hecho (12.3.1): adaptadores por proveedor, script de auditoría, tabla de equivalencias con revisión obligatoria y pruebas (59 nuevas).
- Pendiente (12.3.2–12.5): capa de unificación, `source`/`updated_at` en la interfaz, importación programada de Oracle's Elixir, contador de CitoAPI y gestión del límite de Leaguepedia (esperas, cuenta bot), comprobaciones previas a publicar.
- Limitaciones de 12.3.1:
  - **Ningún endpoint real de CitoAPI, Leaguepedia ni Oracle's Elixir se ha probado** (el entorno de desarrollo no tiene acceso de red a esos hosts). Los esquemas se basan en la documentación y ejemplos públicos; ejecuta `npm run audit:sources` y contrasta.
  - Leaguepedia: `DateJoin`, `DateLeave` y `Role` de `Tenures` están sin verificar; sin cuenta bot el acceso anónimo es muy lento.
  - CitoAPI: solo 2 endpoints con ejemplo de respuesta publicado; el resto sigue pendiente.
  - Oracle's Elixir: la unidad de `gamelength` y la zona horaria de `date` están sin confirmar; no hay URL de descarga fijada.
  - La tabla de equivalencias está vacía: ninguna equivalencia se ha confirmado todavía.
