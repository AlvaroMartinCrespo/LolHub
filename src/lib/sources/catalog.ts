/**
 * Paso 12.1 — Catálogo de fuentes de datos (coste 0 €).
 * Fuente única de verdad de qué aporta cada proveedor, sus límites y cautelas, según lo
 * investigado el 15/10/2026. Módulo puro (sin acceso a red ni secretos): lo usan la página
 * /fuentes, las pruebas y, en 12.3, la capa de unificación.
 * Combinar fuentes NO suma cuotas ni permisos de uso: cada proveedor tiene los suyos.
 */

export const SOURCE_IDS = ["pandascore", "citoapi", "oracleselixir", "leaguepedia", "datadragon", "riotapi"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export type SourceAccess = "api-key" | "api-open" | "files";
export type SourceRole = "principal" | "complementaria" | "futura";

export interface SourceInfo {
  id: SourceId;
  name: string;
  access: SourceAccess;
  role: SourceRole;
  /** Plan gratuito y su cuota. */
  freePlan: string;
  /** Para qué se usa en LoL Hub. */
  usedFor: string;
  /** Límites y cautelas a respetar. */
  cautions: string[];
  /** Licencia / condiciones de reutilización conocidas. */
  license: string;
  /** Si hay que atribuir la fuente en la web. */
  attributionRequired: boolean;
  /** Cuota numérica verificable (null si no hay o no se controla por contador). */
  quota: { calls: number; per: "hour" | "month" } | null;
}

export const SOURCES: readonly SourceInfo[] = [
  {
    id: "pandascore",
    name: "PandaScore Free",
    access: "api-key",
    role: "principal",
    freePlan: "1.000 peticiones/hora. Incluye calendario, resultados y datos de contexto (equipos, jugadores, torneos).",
    usedFor: "Fuente principal: partidos, resultados, ligas, equipos, jugadores.",
    cautions: [
      "No incluye estadísticas históricas post-partido (KDA, oro, daño…): requieren el plan Historical, de pago.",
      "Verificar en tu cuenta qué endpoints responden (npm run audit).",
    ],
    license: "Términos de uso de PandaScore.",
    attributionRequired: true,
    quota: { calls: 1000, per: "hour" },
  },
  {
    id: "citoapi",
    name: "CitoAPI Free",
    access: "api-key",
    role: "complementaria",
    freePlan: "500 llamadas/mes.",
    usedFor: "Probar y rellenar huecos puntuales: estadísticas de jugador, historial de rosters, fichajes.",
    cautions: [
      "Cuota muy baja (≈16 llamadas/día): no sirve para tráfico en vivo.",
      "Los datos en directo y los webhooks son de planes de pago.",
      "Precios y límites por minuto varían entre sus páginas: confirmarlos en el panel.",
      "No llamarla nunca por cada visita de usuario.",
    ],
    license: "Términos de uso de CitoAPI (revisar antes de publicar).",
    attributionRequired: true,
    quota: { calls: 500, per: "month" },
  },
  {
    id: "oracleselixir",
    name: "Oracle's Elixir",
    access: "files",
    role: "complementaria",
    freePlan: "Descarga gratuita de CSV con estadísticas por partida de las principales ligas.",
    usedFor: "Histórico detallado: KDA, oro, daño, visión, campeones. Se importa a nuestra base de datos (Supabase).",
    cautions: [
      "Son archivos, no una API, y se actualizan cada cierto tiempo (no en directo).",
      "Las estadísticas de partida son propiedad de Riot Games y su uso debe seguir sus políticas.",
      "Revisar condiciones de reutilización y atribuir.",
    ],
    license: "Datos de Riot Games distribuidos por Oracle's Elixir; revisar sus condiciones de reutilización.",
    attributionRequired: true,
    quota: null,
  },
  {
    id: "leaguepedia",
    name: "Leaguepedia (Cargo API)",
    access: "api-open",
    role: "complementaria",
    freePlan: "Gratuita, sin clave.",
    usedFor: "Metadatos: rosters, historial de equipos, torneos, logos de equipo.",
    cautions: [
      "Licencia CC-BY-SA: hay que atribuir y la cláusula de compartir igual puede afectar a datos derivados.",
      "Rate limit agresivo: el error llega dentro del cuerpo de una respuesta HTTP 200.",
      "Una cuenta bot eleva el límite.",
      "Caché larga; nunca llamarla por cada visita de usuario.",
    ],
    license: "CC-BY-SA.",
    attributionRequired: true,
    quota: null,
  },
  {
    id: "datadragon",
    name: "Data Dragon (Riot)",
    access: "api-open",
    role: "complementaria",
    freePlan: "Gratuita, sin clave ni límite de peticiones.",
    usedFor: "Nombres e imágenes de campeones, objetos y runas para las estadísticas por campeón.",
    cautions: ["Solo datos estáticos del juego."],
    license: "Contenido de Riot Games; seguir sus políticas de uso.",
    attributionRequired: true,
    quota: null,
  },
  {
    id: "riotapi",
    name: "API de Riot (clave de desarrollador)",
    access: "api-key",
    role: "futura",
    freePlan: "Gratuita, con clave.",
    usedFor: "Futuro: Solo Queue, ranked, LP (sección 3.5 del plan).",
    cautions: [
      "No cubre calendario profesional.",
      "Requiere registrar la aplicación y cumplir sus términos.",
    ],
    license: "Términos de la API de Riot Games.",
    attributionRequired: true,
    quota: null,
  },
];

/** Fuente descartada para producción (documentada para no usarla por error). */
export const NOT_RECOMMENDED = {
  name: "API de lolesports de Riot",
  reason:
    "No está documentada oficialmente. Usa una clave pública que cambia sin aviso, así que puede romperse en cualquier momento.",
} as const;

export const RIOT_DISCLAIMER =
  "LoL Hub no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de sus propiedades. League of Legends y Riot Games son marcas comerciales o marcas registradas de Riot Games, Inc.";

export const SOURCES_RESEARCHED_ON = "2026-10-15";

export function getSource(id: SourceId): SourceInfo {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`Fuente desconocida: ${id}`);
  return s;
}
export const isSourceId = (v: unknown): v is SourceId => typeof v === "string" && (SOURCE_IDS as readonly string[]).includes(v);

/** Fuentes que consumen cuota controlable por contador (se bloquean al agotarse el margen en 12.3). */
export const quotaLimitedSources = (): SourceInfo[] => SOURCES.filter((s) => s.quota !== null);
