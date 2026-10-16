# Calidad final (Paso 10)

## Pruebas automáticas (`npm test`, Vitest)
| Archivo | Qué cubre |
|---|---|
| `tests/filters.test.ts` | Filtros (liga, región, equipo, torneo, búsqueda sin tildes), fechas en zona local (hoy, 7 días, día concreto), periodo, orden y opciones |
| `tests/transform.test.ts` | Normalización de fechas, estados, nombres y marcadores (por `team_id`), mapas, validación tolerante |
| `tests/stats.test.ts` | Agregaciones (V/D, %, mapas, forma), exclusiones, muestra mínima, formatos mezclados, validación de coherencia y filtros |
| `tests/services.test.ts` | **Integración de los servicios de API** con `fetch` simulado: cabeceras, paginación, caché, 401/403/404/429/5xx/red, reintentos, datos de reserva, validación por elemento, historial paginado |
| `tests/components.test.tsx` | Componentes (jsdom): accesibilidad con **axe-core**, teclado en filtros, fallback de imágenes, debounce de búsqueda, portada con filtros |
| `tests/contrast.test.ts` | Contraste WCAG AA (≥ 4.5:1) de la paleta y de los colores de estado |
| `tests/security.test.ts` | Análisis estático: token solo en `config/env.ts`, `server-only` en módulos de servidor, cliente sin imports de servidor, rutas internas protegidas |

Los datos de `tests/fixtures.ts` son **sintéticos y exclusivos de las pruebas**; nunca se importan desde `src/`.

## Token no expuesto
- `npm run verify:token` compila con un token «centinela», lo busca en todo `.next` y en las páginas servidas. Resultado en este desarrollo: sin fugas.
- `npm run check:prod` repite la comprobación contra un despliegue real (ver `docs/despliegue.md`).

## Revisión de accesibilidad
- Automática: axe-core sobre tarjetas, filtros (incluido el desplegable abierto), estados, tablas, formularios y portada completa → 0 violaciones.
- Contraste: calculado con la paleta real (`contrast.test.ts`).
- Teclado: enlace «Saltar al contenido», `focus-visible` en todos los controles, filtros con casillas nativas, Escape cierra el desplegable y devuelve el foco, formularios de estadísticas funcionan sin JavaScript.
- Etiquetas: `aria-label` en tarjetas y marcadores, tablas con `caption`/`scope`, regiones con `aria-labelledby`, estados de carga/error con `role="status"`/`alert`, `lang="es"`.
- Imágenes: `alt` descriptivo (o vacío si es decorativa), tamaño reservado, carga diferida y fallback.
- Pendiente (manual): contraste de texto sobre imágenes reales, lector de pantalla real y zoom 200 %.

## Rendimiento
- Renderizado en servidor; la portada envía ~114 kB de JS en el primer acceso; resto de rutas ~110 kB (`npm run build`).
- Sin librerías de gráficos ni fuentes externas (gráficos en HTML/CSS, fuentes del sistema).
- Listas con «Mostrar más» (24 en 24) y paginación en servidor; caché de datos por tipo (ver `docs/despliegue.md`).
- No se midió Lighthouse/Core Web Vitals: requiere navegador y datos reales.

## Estados vacíos y de error
Cubiertos y probados: sin datos, sin coincidencias de filtros (con «Restablecer»), error por sección con «Reintentar», 404 de entidades, datos desactualizados.

## Revisión responsive (móvil, tablet, escritorio)
- Diseño con rejillas `sm:`/`lg:` (1 → 2 → 3 columnas), cabecera con salto de línea, tablas con desplazamiento horizontal propio, controles de al menos 40 px de alto.
- **No se probó en dispositivos ni navegadores reales** (el entorno de desarrollo no tiene navegador). Lista de comprobación manual: 360 px, 768 px y 1280 px en `/`, `/partidos/[id]`, `/equipos/[id]`, `/equipos/[id]/estadisticas`, `/comparar`.
