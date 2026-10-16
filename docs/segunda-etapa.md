# Segunda etapa (Paso 11)

| Función | Ruta / archivo | Cómo funciona |
|---|---|---|
| Favoritos sin cuenta | `/favoritos`, botón «Seguir» en `/equipos/[id]`, `src/lib/favorites/` | Equipos guardados en `localStorage` (máx. 30). Si el navegador bloquea el almacenamiento, se mantienen en memoria durante la sesión. No se sincronizan entre dispositivos. |
| Próximos partidos de favoritos | `/favoritos/proximos?ids=…` | Consulta los próximos partidos de cada equipo (máx. 10) y los fusiona sin duplicados. |
| Calendario por día | `/calendario?fecha=YYYY-MM-DD` | Navegación día anterior/siguiente, tira de 7 días, selector de fecha y botón «Hoy». El servidor pide una ventana UTC de 3 días y el navegador recorta al día local. Máx. 200 partidos por ventana (se avisa). |
| Enfrentamientos directos | `/comparar` (sección nueva) | Series finalizadas entre ambos equipos, con balance de series y mapas. Usa los últimos 300 partidos de cada equipo y los filtros activos. |
| Récords | `/equipos/[id]/estadisticas` (sección nueva) | Mayores rachas de victorias/derrotas, mayor victoria, partida más larga y más corta; sobre la muestra filtrada (filtra por temporada para «récords de temporada»). |
| Buscador global | `/buscar?q=`, campo en la cabecera | Equipos, jugadores y ligas con `search[name]`. Formulario GET (funciona sin JS). |
| Worlds / MSI | `/internacionales` | Ligas localizadas **por nombre en la API** (sin ids fijos) con torneos recientes, próximos partidos y resultados. |
| Recordatorios y exportación | `/partidos/[id]/ics`, `/favoritos/ics?ids=…` | Archivo `.ics` con recordatorio opcional (0, 15, 30 o 60 min antes). La hora de fin es una **estimación de 2 h** (la fuente no da la de partidos futuros) y así se indica en el evento. |
| Panel de frescura | `/estado` | Última respuesta correcta, cuota restante, último fallo, tiempos de caché por tipo y últimas consultas guardadas por la instancia. |

## Limitaciones
- Endpoints y parámetros nuevos sin verificar con respuestas reales: `/lol/matches` con `range[scheduled_at]`, `search[name]` en equipos, jugadores y ligas.
- Worlds/MSI dependen de que los nombres de las ligas en la API coincidan con «Worlds», «World Championship», «MSI» o «Mid-Season Invitational».
- Los recordatorios son avisos del calendario del usuario (VALARM); no hay notificaciones push ni del navegador (requerirían permisos y un service worker).
- El panel `/estado` refleja solo la memoria de la instancia que responde (serverless).
- Favoritos: solo equipos (no jugadores ni ligas).
