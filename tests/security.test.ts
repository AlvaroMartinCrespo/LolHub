import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}
const files = walk(SRC).map((p) => ({ path: relative(process.cwd(), p), text: readFileSync(p, "utf8") }));

describe("el token no se expone", () => {
  it("ningún código lee variables NEXT_PUBLIC_", () => {
    expect(files.filter((f) => /process\.env\.NEXT_PUBLIC_|process\.env\[/.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it("solo config/env.ts lee las claves de Supabase", () => {
    const users = files.filter((f) => /SUPABASE_SERVICE_ROLE_KEY/.test(f.text)).map((f) => f.path);
    expect(users).toEqual(["src/lib/config/env.ts"]);
  });

  it("solo config/env.ts lee PANDASCORE_API_TOKEN", () => {
    const users = files.filter((f) => f.text.includes("PANDASCORE_API_TOKEN")).map((f) => f.path);
    expect(users).toEqual(["src/lib/config/env.ts"]);
  });

  it("los módulos con secretos o red importan «server-only»", () => {
    const mustBeServer = [
      "src/lib/config/env.ts", "src/lib/services/pandascore-client.ts", "src/lib/services/lol.ts",
      "src/lib/services/last-good.ts", "src/lib/services/freshness.ts", "src/lib/services/safe.ts", "src/lib/server/auth.ts",
    ];
    for (const p of mustBeServer) {
      const f = files.find((x) => x.path === p);
      expect(f, p).toBeDefined();
      expect(f!.text, p).toContain('import "server-only"');
    }
  });

  it("los componentes de cliente no importan servicios ni configuración de servidor", () => {
    const offenders = files
      .filter((f) => /^\s*["']use client["']/.test(f.text))
      .filter((f) => /from\s+["']@\/lib\/(services|config|server)/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("las rutas internas exigen autorización", () => {
    for (const p of ["src/app/api/health/route.ts", "src/app/api/cron/warm/route.ts"]) {
      expect(files.find((f) => f.path === p)!.text).toContain("authorize(req)");
    }
  });

  it("el token no aparece escrito en el código ni en .env.example", () => {
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    expect(example).toMatch(/PANDASCORE_API_TOKEN=\s*$/m);
    expect(example).toMatch(/CRON_SECRET=\s*$/m);
  });
});
