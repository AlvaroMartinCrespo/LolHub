// Comprueba que el token no acaba en el build ni en las respuestas HTML.
// Compila con un token «centinela» y lo busca en .next y en las páginas servidas.
import { execSync, spawn } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SENTINEL = "SENTINEL_TOKEN_9f3c1a7e5b";
const env = { ...process.env, PANDASCORE_API_TOKEN: SENTINEL, CRON_SECRET: "SENTINEL_CRON_2b8d4f6a0c1e" };

console.log("Compilando con token centinela…");
execSync("npx next build", { stdio: "ignore", env });

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) { if (f !== "cache") yield* walk(p); }
    else if (s.size < 20_000_000) yield p;
  }
}
let leaks = [];
for (const p of walk(".next")) {
  const t = readFileSync(p, "latin1");
  if (t.includes(SENTINEL) || t.includes(env.CRON_SECRET)) leaks.push(p);
}
console.log(leaks.length ? `FAIL: secretos en el build:\n${leaks.join("\n")}` : "OK   .next no contiene secretos");

const port = 3199;
const server = spawn("npx", ["next", "start", "-p", String(port)], { env, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 5000));
for (const path of ["/", "/competiciones", "/comparar", "/equipos/1", "/partidos/1"]) {
  const body = await fetch(`http://localhost:${port}${path}`).then((r) => r.text()).catch(() => "");
  const bad = body.includes(SENTINEL) || body.includes(env.CRON_SECRET);
  if (bad) leaks.push(path);
  console.log(`${bad ? "FAIL" : "OK  "} respuesta ${path}`);
}
server.kill();
process.exit(leaks.length ? 1 : 0);
