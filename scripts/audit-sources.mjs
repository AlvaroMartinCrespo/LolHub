// Paso 12.3.1 — Audita las fuentes complementarias con el mismo método que el Paso 1:
// prueba endpoints reales, guarda ejemplos de respuesta y documenta qué hay, qué falta y qué límites aplican.
//
// Uso:   npm run audit:sources                       (todas)
//        npm run audit:sources -- --only=leaguepedia (una o varias, separadas por comas)
// Opciones: --cito-budget=12   máximo de llamadas a CitoAPI (cuota gratuita: 500/mes; por defecto 12)
//           --lp-delay=65      segundos entre consultas a Leaguepedia (acceso anónimo ≈ 1 por minuto; 0 = sin espera)
//           --oe-file=ruta     CSV local de Oracle's Elixir (si no, usa ORACLESELIXIR_CSV_URL)
// Requiere Node >= 20.6. Con .env: CITOAPI_KEY y, para Oracle's Elixir, ORACLESELIXIR_CSV_URL.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  compareFields, detectMediaWikiError, findFirst, keysOf, rateLimitHeaders, summarizeOraclesElixir,
} from "./lib/audit-helpers.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, v = "true"] = a.slice(2).split("="); return [k, v]; }),
);
const ALL = ["citoapi", "leaguepedia", "oracleselixir"];
const only = args.only ? args.only.split(",").map((s) => s.trim()) : ALL;
for (const s of only) if (!ALL.includes(s)) { console.error(`Fuente desconocida: ${s}. Opciones: ${ALL.join(", ")}`); process.exit(1); }

const OUT = new URL("../docs/samples/", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { generated_at: new Date().toISOString(), sources: {} };
const save = async (source, name, data) => {
  await mkdir(new URL(`${source}/`, OUT), { recursive: true });
  await writeFile(new URL(`${source}/${name}.json`, OUT), JSON.stringify(data, null, 2));
};
const TIMEOUT = 30_000;

// ── CitoAPI ────────────────────────────────────────────────
async function auditCito() {
  const key = process.env.CITOAPI_KEY;
  const base = "https://api.citoapi.com/api/v1";
  const budget = Math.max(1, Number(args["cito-budget"] ?? 12));
  const r = { available: false, calls_used: 0, call_budget: budget, endpoints: {}, notes: [] };
  report.sources.citoapi = r;
  if (!key) { r.notes.push("Falta CITOAPI_KEY: no se probó."); console.log("citoapi: omitida (falta CITOAPI_KEY)"); return; }
  const ids = {};
  const probe = async (name, path, after) => {
    if (r.calls_used >= budget) { r.endpoints[name] = { skipped: "presupuesto de llamadas agotado" }; return; }
    r.calls_used++;
    let res, body;
    try {
      res = await fetch(base + path, { headers: { "x-api-key": key, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT) });
      const text = await res.text();
      try { body = JSON.parse(text); } catch { body = text; }
    } catch (e) { r.endpoints[name] = { path, error: String(e.message ?? e) }; console.log(`ERR  citoapi ${name}`); return; }
    const sample = Array.isArray(body) ? body.slice(0, 3) : body;
    await save("citoapi", name, sample);
    r.endpoints[name] = {
      path, status: res.status, available: res.ok, rate_limit_headers: rateLimitHeaders(res.headers),
      fields: res.ok && typeof body === "object" ? [...keysOf(sample)].sort() : [],
      error_body: res.ok ? undefined : body,
    };
    if (res.ok) r.available = true;
    console.log(`${String(res.status).padEnd(4)} citoapi ${name}`);
    if (res.ok && after) after(body);
  };
  await probe("lol_leagues", "/lol/leagues");
  await probe("lol_schedule_upcoming", "/lol/schedule/upcoming", (b) => { ids.match = findFirst(b, ["matchId", "id"]); });
  if (ids.match) {
    await probe("lol_match_games", `/lol/matches/${encodeURIComponent(ids.match)}/games`);
    await probe("lol_match_detail", `/lol/matches/${encodeURIComponent(ids.match)}`);
  } else r.notes.push("No se pudo extraer un ID de partido del calendario: se omiten los sondeos de partido.");
  await probe("lol_players", "/lol/players", (b) => { ids.player = findFirst(b, ["playerId", "id"]); });
  if (ids.player) {
    await probe("lol_player_teams", `/lol/players/${encodeURIComponent(ids.player)}/teams`);
    await probe("lol_player_stats", `/lol/players/${encodeURIComponent(ids.player)}/stats`);
  }
  await probe("lol_teams", "/lol/teams", (b) => { ids.team = findFirst(b, ["slug", "teamSlug"]); });
  if (ids.team) await probe("lol_team_roster_history", `/lol/teams/${encodeURIComponent(ids.team)}/roster/history`);
  await probe("lol_transfers", "/lol/transfers");
  r.notes.push(`Llamadas usadas: ${r.calls_used} de ${budget} permitidas por esta ejecución (cuota gratuita: 500/mes). Comprueba el consumo real en tu panel.`);
}

// ── Leaguepedia ────────────────────────────────────────────
// Los campos que pide el adaptador (src/lib/sources/adapters/leaguepedia.ts → LEAGUEPEDIA_FIELDS). Una prueba comprueba que coinciden.
const LP_REQUESTED = {
  Teams: ["Name", "OverviewPage", "Short", "Location", "Region", "Image", "IsDisbanded"],
  Tenures: ["Player", "Team", "IsCurrent", "DateJoin", "DateLeave", "Role"],
};
async function auditLeaguepedia() {
  const api = "https://lol.fandom.com/api.php";
  const delay = Number(args["lp-delay"] ?? 65) * 1000;
  const r = { available: false, delay_seconds: delay / 1000, endpoints: {}, field_check: {}, notes: [] };
  report.sources.leaguepedia = r;
  let first = true;
  let blocked = false;
  const call = async (name, params) => {
    if (blocked) { r.endpoints[name] = { skipped: "límite de uso alcanzado" }; return null; }
    if (!first && delay > 0) { console.log(`   (espera ${delay / 1000}s para respetar el límite…)`); await sleep(delay); }
    first = false;
    const url = new URL(api);
    for (const [k, v] of Object.entries({ format: "json", maxlag: "5", ...params })) url.searchParams.set(k, v);
    let res, body;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT) });
      const text = await res.text();
      try { body = JSON.parse(text); } catch { body = text; }
    } catch (e) { r.endpoints[name] = { error: String(e.message ?? e) }; console.log(`ERR  leaguepedia ${name}`); return null; }
    const mwError = detectMediaWikiError(body);
    await save("leaguepedia", name, Array.isArray(body) ? body.slice(0, 3) : body);
    r.endpoints[name] = {
      url: url.toString(), status: res.status, available: res.ok && !mwError,
      error_inside_200: mwError ?? undefined, rate_limit_headers: rateLimitHeaders(res.headers),
      fields: res.ok && !mwError && typeof body === "object" ? [...keysOf(body)].sort().slice(0, 80) : [],
    };
    console.log(`${String(res.status).padEnd(4)} leaguepedia ${name}${mwError ? `  ⚠ error dentro del 200: ${mwError.code}` : ""}`);
    if (mwError?.rateLimited) { blocked = true; r.notes.push("Se alcanzó el límite de uso (error dentro de HTTP 200). Repite con --lp-delay mayor o usa una cuenta bot."); }
    if (!res.ok || mwError) return null;
    r.available = true;
    return body;
  };
  for (const table of Object.keys(LP_REQUESTED)) {
    const body = await call(`cargofields_${table}`, { action: "cargofields", table });
    const fields = body?.cargofields ? Object.keys(body.cargofields) : null;
    r.field_check[table] = fields ? compareFields(LP_REQUESTED[table], fields) : { unverified: "no se pudo leer cargofields" };
  }
  await call("cargoquery_teams", { action: "cargoquery", tables: "Teams", fields: LP_REQUESTED.Teams.join(","), where: 'Region="Europe"', limit: "3" });
  const missingTen = r.field_check.Tenures?.missing ?? [];
  const tenFields = LP_REQUESTED.Tenures.filter((f) => !missingTen.includes(f));
  if (tenFields.length > 0) await call("cargoquery_tenures", { action: "cargoquery", tables: "Tenures", fields: tenFields.join(","), where: 'IsCurrent="1"', limit: "3" });
  r.notes.push("Los campos en field_check.*.missing NO existen: corrige LEAGUEPEDIA_FIELDS y este script antes de usar el adaptador.");
}

// ── Oracle's Elixir ────────────────────────────────────────
async function auditOraclesElixir() {
  const src = args["oe-file"] ?? process.env.ORACLESELIXIR_CSV_URL?.trim();
  const r = { available: false, notes: [] };
  report.sources.oracleselixir = r;
  if (!src) { r.notes.push("Sin ORACLESELIXIR_CSV_URL ni --oe-file: no se probó."); console.log("oracleselixir: omitida (sin origen)"); return; }
  let text;
  try {
    if (/^https:\/\//i.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(120_000) });
      r.http_status = res.status;
      if (!res.ok) { r.notes.push(`La descarga devolvió HTTP ${res.status}.`); console.log(`${res.status} oracleselixir descarga`); return; }
      text = await res.text();
    } else text = await readFile(src, "utf8");
  } catch (e) { r.notes.push(`No se pudo leer el CSV: ${String(e.message ?? e)}`); console.log("ERR  oracleselixir lectura"); return; }
  const summary = summarizeOraclesElixir(text);
  r.available = summary.missingRequired.length === 0;
  r.summary = { ...summary, sampleRows: undefined };
  // Solo 3 filas de muestra: los datos son de Oracle's Elixir/Riot y no se redistribuyen enteros.
  await save("oracleselixir", "header_and_sample", { columns: summary.columns, sampleRows: summary.sampleRows });
  console.log(`${r.available ? "OK  " : "FALTAN"} oracleselixir ${summary.rows} filas, ${summary.games} partidas`);
  if (summary.missingRequired.length) r.notes.push(`Faltan columnas obligatorias: ${summary.missingRequired.join(", ")}.`);
  if (summary.gamelength.suggestedUnit) r.notes.push(`gamelength: mediana ${summary.gamelength.median} → unidad sugerida «${summary.gamelength.suggestedUnit}». Confírmalo y pásalo al adaptador (gameLengthUnit).`);
}

const runners = { citoapi: auditCito, leaguepedia: auditLeaguepedia, oracleselixir: auditOraclesElixir };
for (const s of only) await runners[s]();
await mkdir(OUT, { recursive: true });
await writeFile(new URL("_report_sources.json", OUT), JSON.stringify(report, null, 2));
console.log("\nListo. Muestras en docs/samples/<fuente>/ e informe en docs/samples/_report_sources.json.");
console.log("Completa docs/02-auditoria-fuentes.md con ese informe.");
