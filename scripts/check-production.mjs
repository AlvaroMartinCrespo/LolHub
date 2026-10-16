// Paso 9: comprobaciones sobre un despliegue real (no usa datos falsos).
// Uso:
//   BASE_URL=https://tu-app.vercel.app CRON_SECRET=xxx node scripts/check-production.mjs
//   Opcional: PANDASCORE_API_TOKEN=xxx  -> verifica que el token no aparece en ninguna respuesta
//   Opcional: --burst=N  -> lanza N llamadas a /api/health (CONSUMEN cuota real de PandaScore; máx. 50)
const BASE = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const TOKEN = process.env.PANDASCORE_API_TOKEN;
const burst = Math.min(50, Number((process.argv.find((a) => a.startsWith("--burst=")) ?? "").split("=")[1]) || 0);

if (!BASE) { console.error("Falta BASE_URL."); process.exit(1); }

let failures = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};
const auth = SECRET ? { Authorization: `Bearer ${SECRET}` } : {};

async function get(path, headers = {}) {
  const res = await fetch(BASE + path, { headers, redirect: "manual" });
  return { res, text: await res.text() };
}

for (const path of ["/", "/competiciones", "/comparar", "/equipos/abc", "/partidos/abc"]) {
  const { res, text } = await get(path);
  check(`GET ${path}`, res.status < 500, `HTTP ${res.status}`);
  if (TOKEN) check(`token ausente en ${path}`, !text.includes(TOKEN));
}

const noAuth = await get("/api/health");
check("/api/health sin credenciales rechazado", noAuth.res.status === 401 || noAuth.res.status === 503, `HTTP ${noAuth.res.status}`);

if (SECRET) {
  const health = await get("/api/health", auth);
  let body = {};
  try { body = JSON.parse(health.text); } catch {}
  check("/api/health con credenciales", health.res.status === 200 && body.ok === true,
    `HTTP ${health.res.status}, upstream=${body.upstream}, cuota restante=${body.rateLimitRemaining ?? "?"}`);
  if (TOKEN) check("token ausente en /api/health", !health.text.includes(TOKEN));

  const warm = await get("/api/cron/warm", auth);
  let w = {};
  try { w = JSON.parse(warm.text); } catch {}
  check("/api/cron/warm", warm.res.status === 200, `HTTP ${warm.res.status} ${JSON.stringify(w.results ?? {})}`);
  const again = await get("/api/cron/warm", auth);
  check("/api/cron/warm es idempotente (2.ª llamada)", again.res.status === warm.res.status);

  if (burst > 0) {
    console.log(`\nRáfaga de ${burst} llamadas a /api/health (consume cuota real)…`);
    const codes = {};
    let last = null;
    for (let i = 0; i < burst; i++) {
      const r = await get("/api/health", auth);
      codes[r.res.status] = (codes[r.res.status] ?? 0) + 1;
      try { last = JSON.parse(r.text); } catch {}
    }
    console.log("Códigos:", codes, "· última cuota restante:", last?.rateLimitRemaining ?? "?", "· upstream:", last?.upstream);
    check("la app responde de forma controlada bajo ráfaga", Object.keys(codes).every((c) => c === "200" || c === "502"));
  }
} else {
  console.log("SKIP pruebas autenticadas: define CRON_SECRET.");
}

console.log(failures ? `\n${failures} comprobación(es) fallida(s).` : "\nTodo correcto.");
process.exit(failures ? 1 : 0);
