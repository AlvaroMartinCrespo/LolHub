import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Autoriza rutas internas (cron y health) con `Authorization: Bearer <CRON_SECRET>`.
 * Vercel envía esa cabecera automáticamente en los cron jobs cuando existe la variable CRON_SECRET.
 * Devuelve una Response de error si no está autorizado, o null si todo bien.
 */
export function authorize(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET no configurado" }, { status: 503 });

  const received = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  const ok = received.length === expected.length && timingSafeEqual(received, expected);
  return ok ? null : Response.json({ error: "No autorizado" }, { status: 401 });
}
