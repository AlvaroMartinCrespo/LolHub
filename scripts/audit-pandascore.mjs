// Paso 1: audita la API real de PandaScore y guarda respuestas reales.
// Uso: npm run audit  (requiere .env con PANDASCORE_API_TOKEN, Node >= 20.6)
import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://api.pandascore.co";
const TOKEN = process.env.PANDASCORE_API_TOKEN;
const OUT = new URL("../docs/samples/", import.meta.url);

if (!TOKEN) {
  console.error("Falta PANDASCORE_API_TOKEN. Copia .env.example a .env y rellénalo.");
  process.exit(1);
}
await mkdir(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IMG_KEY = /(image|logo|photo|picture|icon|url)/i;

function findImageFields(obj, path = "", acc = new Set()) {
  if (Array.isArray(obj)) { obj.slice(0, 3).forEach((o) => findImageFields(o, path + "[]", acc)); return acc; }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const p = path ? `${path}.${k}` : k;
      if (typeof v === "string" && IMG_KEY.test(k) && /^https?:\/\//.test(v)) acc.add(p);
      else findImageFields(v, p, acc);
    }
  }
  return acc;
}
function keysOf(obj, path = "", acc = new Set()) {
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

async function get(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { url: url.toString(), status: res.status, headers: res.headers, body };
}

const probes = [
  { name: "lol_leagues", path: "/lol/leagues", params: { "page[size]": 5 } },
  { name: "lol_series_past", path: "/lol/series/past", params: { "page[size]": 5, sort: "-begin_at" } },
  { name: "lol_tournaments_upcoming", path: "/lol/tournaments/upcoming", params: { "page[size]": 5 } },
  { name: "lol_teams", path: "/lol/teams", params: { "page[size]": 5 } },
  { name: "lol_players", path: "/lol/players", params: { "page[size]": 5 } },
  { name: "lol_matches_upcoming", path: "/lol/matches/upcoming", params: { "page[size]": 5, sort: "begin_at" } },
  { name: "lol_matches_running", path: "/lol/matches/running", params: { "page[size]": 5 } },
  { name: "lol_matches_past", path: "/lol/matches/past", params: { "page[size]": 5, sort: "-begin_at" } },
  { name: "lol_matches_past_oldest", path: "/lol/matches/past", params: { "page[size]": 5, sort: "begin_at" } },
];
const dependent = [
  { name: "lol_match_detail", from: "lol_matches_past", path: (id) => `/lol/matches/${id}` },
  { name: "lol_team_detail", from: "lol_teams", path: (id) => `/lol/teams/${id}` },
  { name: "lol_player_detail", from: "lol_players", path: (id) => `/lol/players/${id}` },
  { name: "lol_player_stats", from: "lol_players", path: (id) => `/lol/players/${id}/stats` },
  { name: "lol_team_stats", from: "lol_teams", path: (id) => `/lol/teams/${id}/stats` },
  { name: "lol_tournament_standings", from: "lol_tournaments_upcoming", path: (id) => `/lol/tournaments/${id}/standings` },
  { name: "lol_tournament_brackets", from: "lol_tournaments_upcoming", path: (id) => `/lol/tournaments/${id}/brackets` },
];

const report = { generated_at: new Date().toISOString(), base: BASE, endpoints: {} };
const firstId = {};

async function run(name, fn) {
  const r = await fn();
  const isArr = Array.isArray(r.body);
  const sample = isArr ? r.body.slice(0, 3) : r.body;
  await writeFile(new URL(`${name}.json`, OUT), JSON.stringify(sample, null, 2));
  firstId[name] = isArr ? r.body[0]?.id : r.body?.id;
  const h = (k) => r.headers.get(k);
  report.endpoints[name] = {
    url: r.url,
    status: r.status,
    available: r.status === 200,
    items_returned: isArr ? r.body.length : null,
    pagination: { "x-page": h("x-page"), "x-per-page": h("x-per-page"), "x-total": h("x-total"), link: h("link") },
    rate_limit: { remaining: h("x-rate-limit-remaining") },
    fields: r.status === 200 ? [...keysOf(sample)].sort() : [],
    image_fields: r.status === 200 ? [...findImageFields(sample)].sort() : [],
    error_body: r.status !== 200 ? r.body : undefined,
  };
  console.log(`${String(r.status).padEnd(4)} ${name}`);
  await sleep(300);
}

for (const p of probes) await run(p.name, () => get(p.path, p.params));
for (const d of dependent) {
  const id = firstId[d.from];
  if (!id) { report.endpoints[d.name] = { available: false, note: `Sin id de ${d.from}` }; continue; }
  await run(d.name, () => get(d.path(id)));
}
await run("lol_matches_past_page2", () => get("/lol/matches/past", { "page[size]": 100, "page[number]": 2 }));

await writeFile(new URL("_report.json", OUT), JSON.stringify(report, null, 2));
const ok = Object.values(report.endpoints).filter((e) => e.available).length;
console.log(`\nListo: ${ok}/${Object.keys(report.endpoints).length} endpoints accesibles.`);
console.log("Respuestas reales en docs/samples/. Completa docs/01-auditoria-pandascore.md con _report.json.");
