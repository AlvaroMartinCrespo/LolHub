// Utilidades puras del auditor de fuentes (Paso 12.3.1). Sin red ni disco: se prueban con Vitest.

/** Itera los registros de un CSV (RFC 4180). Debe coincidir con iterateCsv de src/lib/sources/adapters/oracleselixir.ts. */
export function* iterateCsv(text) {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = text.length;
  let field = "";
  let row = [];
  let inQuotes = false;
  let any = false;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; any = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; any = true; i++; continue; }
    if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      i++;
      if (any || field !== "" || row.length > 0) { row.push(field); yield row; }
      row = []; field = ""; any = false;
      continue;
    }
    field += c; any = true; i++;
  }
  if (any || field !== "" || row.length > 0) { row.push(field); yield row; }
}

/** Grupos de columnas imprescindibles para el adaptador (al menos una de cada grupo). */
export const OE_REQUIRED = [["gameid"], ["participantid"], ["side"], ["result"], ["gamelength"]];
/** Columnas opcionales con sus alias (nuevo | antiguo). */
export const OE_OPTIONAL = [
  ["playername", "player"], ["teamname", "team"], ["playerid"], ["teamid"], ["position"], ["champion"],
  ["kills", "k"], ["deaths", "d"], ["assists", "a"], ["totalgold"], ["damagetochampions", "dmgtochamps"],
  ["minionkills"], ["monsterkills"], ["wardsplaced", "wards"], ["league"], ["year"], ["split"], ["playoffs"],
  ["date"], ["game"], ["patch", "patchno"], ["datacomplete"],
];

const median = (xs) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const tally = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

/** Resumen de un CSV de Oracle's Elixir para decidir qué columnas y unidades usa realmente el archivo. */
export function summarizeOraclesElixir(text, { sampleRows = 3, maxDistinct = 12 } = {}) {
  const it = iterateCsv(text);
  const first = it.next();
  const columns = first.done ? [] : first.value.map((h) => h.trim().toLowerCase());
  const has = (c) => columns.includes(c);
  const missingRequired = OE_REQUIRED.filter((g) => !g.some(has)).map((g) => g.join("|"));
  const optionalFound = OE_OPTIONAL.filter((g) => g.some(has)).map((g) => g.find(has));
  const optionalMissing = OE_OPTIONAL.filter((g) => !g.some(has)).map((g) => g.join("|"));

  const idx = (name) => columns.indexOf(name);
  const ci = { gid: idx("gameid"), pid: idx("participantid"), len: idx("gamelength"), res: idx("result"), date: idx("date"), dc: idx("datacomplete") };

  let rows = 0;
  const games = new Set();
  const participants = new Map();
  const results = new Map();
  const dataComplete = new Map();
  const teamLengths = [];
  const dateSamples = new Set();
  const samples = [];
  for (const cells of it) {
    if (cells.length === 1 && cells[0].trim() === "") continue;
    rows++;
    if (ci.gid >= 0) games.add(cells[ci.gid]);
    const pid = ci.pid >= 0 ? cells[ci.pid]?.trim() : "";
    if (pid) tally(participants, pid);
    if (ci.res >= 0) tally(results, cells[ci.res]?.trim() ?? "");
    if (ci.dc >= 0) tally(dataComplete, cells[ci.dc]?.trim() ?? "");
    if ((pid === "100" || pid === "200") && ci.len >= 0) {
      const v = Number(cells[ci.len]);
      if (Number.isFinite(v) && cells[ci.len]?.trim() !== "") teamLengths.push(v);
    }
    if (ci.date >= 0 && dateSamples.size < 5 && cells[ci.date]) dateSamples.add(cells[ci.date]);
    if (samples.length < sampleRows) samples.push(Object.fromEntries(columns.map((c, k) => [c, cells[k] ?? ""])));
  }
  const med = median(teamLengths);
  const obj = (m) => Object.fromEntries([...m.entries()].slice(0, maxDistinct));
  return {
    columns,
    rows,
    games: games.size,
    missingRequired,
    optionalFound,
    optionalMissing,
    participantIds: obj(participants),
    resultValues: obj(results),
    dataCompleteValues: obj(dataComplete),
    gamelength: {
      teamRowsMeasured: teamLengths.length,
      min: teamLengths.length ? Math.min(...teamLengths) : null,
      max: teamLengths.length ? Math.max(...teamLengths) : null,
      median: med,
      // Sugerencia, nunca se aplica sola: un mapa profesional dura 20–60 min.
      suggestedUnit: med === null ? null : med > 200 ? "seconds" : "minutes",
    },
    dateSamples: [...dateSamples],
    sampleRows: samples,
  };
}

/** Compara los campos que el adaptador pide con los que declara la fuente (cargofields). */
export function compareFields(requested, actual) {
  const have = new Set(actual);
  return {
    present: requested.filter((f) => have.has(f)),
    missing: requested.filter((f) => !have.has(f)),
  };
}

/** Errores de MediaWiki dentro de una respuesta HTTP 200. */
export function detectMediaWikiError(body) {
  if (body && typeof body === "object" && body.error && typeof body.error === "object") {
    return { code: String(body.error.code ?? "desconocido"), rateLimited: body.error.code === "ratelimited" };
  }
  return null;
}

/** Primer valor de alguna de las claves indicadas, buscando en profundidad (para encadenar sondeos). */
export function findFirst(value, keys, depth = 0) {
  if (depth > 6 || value === null || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const v of value) { const r = findFirst(v, keys, depth + 1); if (r !== undefined) return r; }
    return undefined;
  }
  for (const k of keys) {
    if (k in value && (typeof value[k] === "string" || typeof value[k] === "number")) return String(value[k]);
  }
  for (const v of Object.values(value)) { const r = findFirst(v, keys, depth + 1); if (r !== undefined) return r; }
  return undefined;
}

/** Cabeceras relacionadas con límites de uso, para documentar cuotas reales. */
export function rateLimitHeaders(headers) {
  const out = {};
  for (const [k, v] of headers.entries()) if (/rate|limit|quota|retry-after|remaining|reset/i.test(k)) out[k] = v;
  return out;
}

/** Claves de un JSON (hasta 3 elementos por lista) para documentar el formato real. */
export function keysOf(obj, path = "", acc = new Set()) {
  if (Array.isArray(obj)) { obj.slice(0, 3).forEach((o) => keysOf(o, path + "[]", acc)); return acc; }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const p = path ? `${path}.${k}` : k;
      acc.add(p);
      keysOf(v, p, acc);
    }
  }
  return acc;
}
