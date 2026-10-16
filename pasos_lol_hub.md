# LoL Hub — Pasos para crear el proyecto

Lista concisa de pasos, en orden, derivada del plan de desarrollo. Termina cada paso antes de pasar al siguiente.

---

## Paso 1 — Auditar y validar la API de PandaScore

- [ ] Revisar el repositorio existente (si lo hay) y conservar lo que funcione.
- [ ] Leer la documentación oficial de PandaScore para League of Legends.
- [ ] Confirmar qué datos incluye tu plan y cuáles requieren pago.
- [ ] Probar los endpoints reales: ligas, torneos, equipos, jugadores, partidos y estadísticas.
- [ ] Comprobar paginación, límites de peticiones, cobertura histórica y datos en directo.
- [ ] Verificar si hay URLs de imágenes (logos, fotos) y sus permisos de uso.
- [ ] Guardar ejemplos reales de respuestas.
- [ ] Documentar qué datos están disponibles, ausentes o restringidos.

**Resultado:** sabes qué puede mostrar la primera versión y qué necesita otra fuente.

---

## Paso 2 — Preparar la base técnica

- [ ] Crear el proyecto con Next.js + TypeScript + Tailwind CSS (compatible con Vercel).
- [ ] Configurar tema oscuro por defecto y diseño responsive.
- [ ] Guardar el token en `PANDASCORE_API_TOKEN` (solo servidor, nunca `NEXT_PUBLIC_*`).
- [ ] Definir tipos TypeScript a partir de las respuestas reales guardadas.
- [ ] Separar carpetas: componentes, tipos, servicios, transformación de datos, configuración y caché.

**Resultado:** la app consulta PandaScore desde el servidor de forma segura.

---

## Paso 3 — Crear la capa de datos

- [ ] Implementar servicios de servidor: ligas, torneos, partidos próximos y recientes, detalle de partido, equipo y jugador.
- [ ] Validar las respuestas externas antes de usarlas.
- [ ] Normalizar fechas, estados, nombres y marcadores.
- [ ] Gestionar errores `401`, `403`, `404`, `429` y `5xx` con reintentos progresivos cuando proceda.
- [ ] Añadir caché y revalidación.
- [ ] Separar el formato de la API del modelo interno (para poder cambiar de proveedor).

---

## Paso 4 — Componentes reutilizables

- [ ] Tarjeta de partido, equipo y jugador.
- [ ] Filtros multiselección (ligas, regiones, fechas).
- [ ] Estados de carga (skeletons), vacío, error y datos desactualizados.
- [ ] Imágenes con tamaño reservado, carga diferida, texto alternativo y fallback (iniciales/avatar).

---

## Paso 5 — Inicio: calendario y resultados

- [ ] Página principal con próximos partidos ordenados cronológicamente.
- [ ] Filtros por liga y región (selección múltiple, «Todas» y restablecer).
- [ ] Filtros por fecha: hoy, próximos días, calendario.
- [ ] Estados diferenciados: programado, en directo, finalizado, aplazado, cancelado.
- [ ] Horas en la zona horaria local del usuario.
- [ ] Sección de resultados recientes con filtros (liga, equipo, torneo, periodo).
- [ ] Distinguir marcador de serie y resultado de cada mapa.
- [ ] Búsqueda rápida con debounce.

**Resultado:** se puede consultar y filtrar calendario y resultados sin errores.

---

## Paso 6 — Ficha del partido

- [ ] Resultado de la serie y de cada mapa.
- [ ] Fecha, duración, torneo, fase y estado.
- [ ] Alineaciones y estadísticas (solo las que proporcione la API).
- [ ] Enlaces a equipos y jugadores.

---

## Paso 7 — Equipos, jugadores y competiciones

- [ ] Ficha de equipo: logo, región, roster, próximos partidos, resultados, historial.
- [ ] Ficha de jugador: equipo, rol, región, historial y partidos recientes.
- [ ] Índice de ligas y torneos construido desde la API (no lista fija).
- [ ] Páginas de liga/torneo: calendario, resultados, clasificación y fases.
- [ ] Enlazar todas las entidades entre sí (partido → equipo → jugador).

**Resultado:** se navega de un partido a sus equipos y jugadores.

---

## Paso 8 — Estadísticas y comparativas

- [ ] Calcular métricas agregadas con fórmulas documentadas (victorias, derrotas, % de victorias).
- [ ] Filtrar por temporada, torneo, rol y periodo cuando haya datos.
- [ ] Mostrar siempre periodo y tamaño de muestra.
- [ ] Añadir gráficos simples solo para métricas fiables.
- [ ] Evitar comparar muestras pequeñas o formatos distintos sin normalizar.
- [ ] Validar que los cálculos coinciden con los datos de origen.

> Si PandaScore no ofrece Solo Queue, MMR o LP, dejarlo como integración futura con la API de Riot.

---

## Paso 9 — Actualización automática y despliegue

- [ ] Configurar Vercel y variables de entorno.
- [ ] Ajustar caché por tipo de dato: próximos (frecuente), directos (muy frecuente si el plan lo permite), finalizados e históricos (largo plazo).
- [ ] Evaluar Vercel Cron Jobs según plan y cuota (procesos idempotentes).
- [ ] Añadir base de datos solo si hace falta (upsert por ID y `updated_at`).
- [ ] Mostrar últimos datos válidos y aviso de «desactualizado» si PandaScore falla.
- [ ] Probar errores de API y límites de cuota en producción.

**Resultado:** los datos se actualizan sin redesplegar.

---

## Paso 10 — Calidad final

- [ ] Probar en móvil, tablet y escritorio.
- [ ] Revisar accesibilidad (teclado, etiquetas, contraste), rendimiento y estados vacíos.
- [ ] Confirmar que el token no se expone.
- [ ] Pruebas unitarias: filtros, fechas, marcadores y agregaciones.
- [ ] Pruebas de integración de los servicios de API.
- [ ] Documentar instalación, configuración y despliegue.

---

## Paso 11 — Segunda etapa (opcional)

- [ ] Favoritos en el navegador (sin cuenta).
- [ ] Vista de calendario por día.
- [ ] Comparador de equipos e historial de enfrentamientos.
- [ ] Récords de temporada.
- [ ] Buscador global.
- [ ] Página de Worlds/MSI.
- [ ] Recordatorios y exportación a calendario.
- [ ] Panel de frescura de datos.

---

## Paso 12 — Combinar varias fuentes de datos (coste 0 €)

Objetivo: cubrir con varias APIs gratuitas lo que PandaScore Free no ofrece, sin superar cuotas y respetando licencias. Combinar fuentes **no suma sus cuotas ni los permisos de uso**: cada proveedor tiene sus propios límites y condiciones.

### 12.1 Qué aporta cada fuente (según lo investigado el 15/10/2026)

| Fuente | Plan gratuito | Usarla para | Límites y cautelas |
|---|---|---|---|
| **PandaScore Free** | 1.000 peticiones/hora. Incluye calendario, resultados y datos de contexto (equipos, jugadores, torneos). | **Fuente principal**: partidos, resultados, ligas, equipos, jugadores. | No incluye estadísticas históricas post-partido (KDA, oro, daño…): requieren el plan Historical, de pago. Verificar en tu cuenta qué endpoints responden. |
| **CitoAPI Free** | 500 llamadas/mes. | Probar y rellenar huecos puntuales: estadísticas de jugador, historial de rosters, fichajes. | Cuota muy baja (≈16 llamadas/día): no sirve para tráfico en vivo. Los datos en directo y los webhooks son de planes de pago. Precios y límites por minuto varían entre sus páginas: confirmarlos en el panel. |
| **Oracle's Elixir** | Descarga gratuita de CSV con estadísticas por partida de las principales ligas. | Histórico detallado: KDA, oro, daño, visión, campeones. Importar a tu propia base de datos. | Son archivos, no una API, y se actualizan cada cierto tiempo (no en directo). Las estadísticas de partida son propiedad de Riot Games y su uso debe seguir sus políticas. Revisar condiciones de reutilización y atribuir. |
| **Leaguepedia (Cargo API)** | Gratuita, sin clave. | Metadatos: rosters, historial de equipos, torneos, logos de equipo. | Licencia CC-BY-SA: hay que atribuir y la cláusula de compartir igual puede afectar a datos derivados. Rate limit agresivo: el error llega dentro del cuerpo de una respuesta HTTP 200. Una cuenta bot eleva el límite. |
| **Data Dragon (Riot)** | Gratuita, sin clave ni límite de peticiones. | Nombres e imágenes de campeones, objetos y runas para las estadísticas por campeón. | Solo datos estáticos del juego. |
| **API de Riot (clave de desarrollador)** | Gratuita, con clave. | Futuro: Solo Queue, ranked, LP (ver sección 3.5 del plan). | No cubre calendario profesional. Requiere registrar la aplicación y cumplir sus términos. |

> Fuente no recomendada para producción: la API de lolesports de Riot, que no está documentada oficialmente. Usa una clave pública que cambia sin aviso, así que puede romperse en cualquier momento.

### 12.2 Reparto de responsabilidades

- [ ] **Calendario, resultados, equipos, jugadores y torneos** → PandaScore.
- [ ] **Estadísticas históricas por partida** → Oracle's Elixir importado a tu base de datos.
- [ ] **Rosters, historial de equipos y logos** → Leaguepedia, con caché larga.
- [ ] **Imágenes y datos de campeones** → Data Dragon.
- [ ] **Huecos puntuales** → CitoAPI, solo si la cuota lo permite.
- [ ] **Solo Queue / ranked** → Riot API, como integración futura.

### 12.3 Pasos de implementación

#### 12.3.1 — Auditar y preparar cada fuente

- [ ] Auditar cada fuente con el mismo método del Paso 1: probar endpoints reales y guardar ejemplos de respuestas.
- [x] Crear un adaptador por proveedor (`pandascore`, `citoapi`, `leaguepedia`, `oracleselixir`) que devuelva el modelo interno del Paso 3.
- [x] Reconciliar identificadores entre fuentes (equipos, jugadores, torneos) con una tabla de equivalencias; no fusionar por nombre sin revisar.

#### 12.3.2 — Unificar y trazar los datos

- [ ] Crear una capa de unificación que decida qué fuente responde a cada dato y qué hacer si falta.
- [ ] Guardar en cada dato su **fuente** y su fecha de actualización (`source`, `updated_at`) para poder mostrarlo en la interfaz.
- [ ] Si una fuente falla, mostrar el último dato válido y avisar de que puede estar desactualizado.
- [x] Importar manualmente el CSV de Oracle's Elixir a una tabla con sus columnas y exponer sus filas mediante una API de solo lectura.

**Avance:** existe almacenamiento opcional de snapshots PandaScore en Supabase (`source_snapshots`) y fallback persistente ante errores transitorios. Un resolver central selecciona y valida rutas/adaptadores. El CSV 2025 se carga manualmente en `oracle_elixir_2025`; `/api/oracle/elixir?gameid=...&league=...` devuelve las filas del mapa. Requiere aplicar migración `0006_oracles_elixir_raw.sql` y tener espacio suficiente en Supabase. La procedencia por dato y el fallback de otras fuentes siguen pendientes.

**Archivo de resultados:** `0007_match_results_archive.sql` conserva los partidos finalizados consultados en una tabla indexada por liga y fecha. La sección `/archivo` permite revisar las ligas y resultados guardados; se va completando a medida que el cron y las páginas consultan resultados. Requiere Supabase configurado y la migración aplicada.

#### 12.3.3 — Cuotas, caché y control de consumo

- [x] Cachear con duración larga todo lo que cambie poco, y no llamar nunca a CitoAPI ni a Leaguepedia por cada visita de usuario.
- [x] Llevar un contador de consumo de la cuota de CitoAPI y bloquear llamadas cuando quede poco margen.
- [x] Gestionar los límites de Leaguepedia, incluyendo el error dentro de una respuesta HTTP 200.

**Avance 12.3.3:** Leaguepedia usa caché diaria, `maxlag=5`, detecta errores de límite en HTTP 200 y no reintenta automáticamente. CitoAPI cachea siete días y reserva cuota atómicamente hasta 475/500 llamadas para conservar un margen de 25. Requiere aplicar `0005_citoapi_quota_guard.sql` y configurar Supabase.

**Resultado de 12.3.3:** ninguna fuente gratuita se agota por el tráfico de la web y los fallos de cuota quedan controlados.

---

### 12.4 Reglas para mezclar datos

- No mezclar estadísticas de fuentes distintas en una misma métrica sin normalizarlas y documentar las diferencias.
- No sumar partidos de dos fuentes sin comprobar que no hay duplicados.
- Mostrar en la interfaz de dónde viene cada dato.
- Añadir una página o pie de atribución con las fuentes y sus licencias (Leaguepedia, Oracle's Elixir, Riot Games, PandaScore).
- Incluir el aviso legal de Riot Games (la web no está respaldada por Riot) y no usar logos ni imágenes sin permiso.
- Si una estadística solo existe en una fuente parcial, indicarlo: «datos parciales, fuente X».

**Estado 12.4:** existen la página de atribución/licencias y el aviso de Riot; no se mezclan estadísticas normalizadas entre fuentes y la importación Oracle usa ID de partida único. La fuente se muestra por petición para PandaScore; la atribución por registro y el aviso de estadísticas parciales en una vista de estadísticas siguen pendientes.

### 12.5 Comprobaciones antes de publicar

- [ ] Revisar de nuevo los términos de uso de cada fuente, sobre todo la reutilización pública y comercial.
- [ ] Confirmar que ninguna clave privada llega al navegador.
- [ ] Simular el agotamiento de cuotas y errores de cada proveedor.
- [ ] Verificar que los números de la web coinciden con los de la fuente original.

**Resultado:** la web muestra más datos sin coste, cada dato indica su fuente y los límites de cada API se respetan.

**Estado 12.5:** las pruebas cubren bloqueo de cuota, errores de adaptadores y rutas protegidas. La revisión de términos y la comparación con datos reales requieren configuración y verificación manual; el test de no exposición de secretos no se ha ejecutado en esta sesión.

---

## Reglas durante todo el proyecto

- No inventar campos, estadísticas ni datos de prueba en la interfaz final.
- Comprobar la documentación oficial antes de usar un endpoint o función de Vercel.
- No marcar una función como terminada si solo tiene interfaz sin datos reales.
- Al terminar cada paso: resumir lo hecho, listar archivos modificados, ejecutar pruebas y documentar limitaciones.
