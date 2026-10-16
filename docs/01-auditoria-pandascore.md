# Paso 1 — Auditoría de la API de PandaScore

Estado: **documentación revisada; pruebas contra la API real pendientes de ejecutar con tu token** (`npm run audit`).
✅ = dato encontrado en documentación consultada · ❓ = por verificar con el token.

## 1. Repositorio existente
No se aportó ninguno; se parte de cero.

## 2. Hechos de la documentación
| Tema | Hallazgo | Estado |
|---|---|---|
| Base URL | `https://api.pandascore.co`, JSON sobre HTTPS | ✅ |
| Autenticación | Token con cabecera `Authorization: Bearer <TOKEN>` (también `?token=`; usar la cabecera) | ✅ |
| Estructura | Liga → Series → Torneos → Partidos | ✅ |
| Paginación | 50 elementos por defecto; cabeceras `Link` (next/prev/first/last) y `X-Per-Page` | ✅ (`X-Page`/`X-Total` ❓) |
| Ordenación | Todos los índices admiten `sort` con varios campos separados por coma | ✅ |
| Filtros | `filter[...]`, `search[...]`, `range[...]` | ✅ |
| Rate limit | Gratuito: 1000 peticiones/hora; cabecera `X-Rate-Limit-Remaining` | ✅ |
| Plan gratuito | Incluye «Schedules, Results & Context Data» (fixtures) | ✅ |
| Plan histórico (pago) | Estadísticas post-partida de LoL (más de 50 datos por jugador y 20 por equipo) | ✅ |
| En directo | Frames/eventos en tiempo real por WebSocket (`wss://live.pandascore.co`, API Live aparte); REST: `/lol/matches/running` | ✅ (acceso con tu plan ❓) |
| Imágenes | Se esperan `image_url` en ligas/equipos/jugadores | ❓ |
| Permisos de imágenes | Sin declaración verificada: revisar términos de PandaScore y derechos de logos antes de publicar | ❓ |

## 3. Endpoints LoL que prueba el script
Ligas `/lol/leagues` · Series `/lol/series/past` · Torneos `/lol/tournaments/upcoming` · Equipos `/lol/teams` · Jugadores `/lol/players` · Partidos `/lol/matches/{upcoming,running,past}` · Detalle `/lol/matches/{id}`, `/lol/teams/{id}`, `/lol/players/{id}` · Stats `/lol/players/{id}/stats`, `/lol/teams/{id}/stats` · `/lol/tournaments/{id}/standings` y `/brackets` · Cobertura histórica (partido más antiguo) · Paginación (página 2, tamaño 100).

## 4. Matriz de disponibilidad (completar con `docs/samples/_report.json`)
| Dato | Endpoint | HTTP | Disponible | Notas |
|---|---|---|---|---|
| Ligas | /lol/leagues | | | |
| Series/torneos | /lol/series, /lol/tournaments | | | |
| Equipos | /lol/teams | | | |
| Jugadores | /lol/players | | | |
| Próximos | /lol/matches/upcoming | | | |
| En directo | /lol/matches/running | | | |
| Pasados | /lol/matches/past | | | |
| Detalle partido (mapas) | /lol/matches/{id} | | | |
| Stats jugador/equipo | …/stats | | | |
| Clasificación | …/standings | | | |
| Cobertura histórica | past?sort=begin_at | | | |
| Imágenes | image_url | | | |

401/403/404 en un endpoint = restringido por plan o inexistente: anótalo como «restringido».

## 5. Alcance provisional de la primera versión
- Probable con plan gratuito: ligas, series, torneos, equipos, jugadores, calendario, resultados, marcadores de serie y partidas.
- Probable que requiera pago: estadísticas detalladas post-partida y datos en directo en tiempo real.
- Otra fuente (futuro, API de Riot): Solo Queue, MMR, LP.
Confirmar con la matriz antes de empezar el Paso 2.

## 6. Ejecución
```bash
cp .env.example .env   # pega tu token
npm run audit          # Node >= 20.6
```
