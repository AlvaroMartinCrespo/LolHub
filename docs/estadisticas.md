# Estadísticas: fórmulas y criterios (Paso 8)

Todas las métricas se calculan en `src/lib/stats/formulas.ts` a partir de los partidos finalizados del equipo
(`/lol/matches/past?filter[opponent_id]=…`, hasta 3 páginas de 100 = 300 partidos).

| Métrica | Fórmula |
|---|---|
| Serie contada | `status = finished`, sin incomparecencia (`forfeit`) y con `winnerTeamId` conocido |
| Series ganadas (V) | series contadas con `winnerTeamId = equipo` |
| Series perdidas (D) | series contadas con ganador distinto |
| % victorias (series) | `V / (V + D) × 100` |
| Mapas ganados / perdidos | partidas `finished` con ganador, en series contadas y sin `forfeit` de la partida |
| % victorias (mapas) | `V_mapas / (V_mapas + D_mapas) × 100` |
| Forma reciente | resultado de las últimas 5 series contadas (más reciente primero) |

## Criterios de fiabilidad
- Se muestran siempre **periodo** (fecha de la serie más antigua y más reciente contada) y **tamaño de muestra** (series y mapas).
- Muestra mínima: `MIN_SAMPLE = 10` series. Por debajo, se avisa y **no se dibujan gráficos**.
- **Formatos mezclados** (Bo1/Bo3/Bo5): se avisa de que el % de series no es comparable; se puede filtrar por formato o usar el % de mapas.
- En la **comparativa** no se resalta ventaja salvo que ambos equipos tengan ≥ 10 series y el mismo formato.
- Se listan los partidos excluidos (incomparecencia, sin ganador, no finalizados).

## Validación de cálculos (`src/lib/stats/validate.ts`)
1. `V + D` debe coincidir con las series contadas.
2. Por serie, el marcador del equipo debe coincidir con los mapas que ganó según `games`.
El resultado se muestra bajo las estadísticas.

## Filtros
Periodo (7/30/90 días/todo), temporada o serie (nombre), torneo (nombre) y formato (al mejor de N).
Filtro por **rol**: no aplicable; requiere estadísticas por jugador que la fuente verificada no ofrece.

## Fuera de alcance
Solo Queue, MMR y LP: integración futura con la API de Riot.
