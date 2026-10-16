import { getSupabaseConfig } from "@/lib/config/env";
import { createOracleElixirStore } from "@/lib/sources/oracleselixir-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gameId = new URL(request.url).searchParams.get("gameid");
  const league = new URL(request.url).searchParams.get("league");
  if (!gameId || !/^[A-Za-z0-9._:-]{1,160}$/.test(gameId) || !league || league.length > 120 || /[\u0000-\u001f]/.test(league)) {
    return Response.json({ error: "gameid o league no válido" }, { status: 400 });
  }

  let config: ReturnType<typeof getSupabaseConfig>;
  try {
    config = getSupabaseConfig();
  } catch {
    return Response.json({ error: "Supabase no está configurado correctamente" }, { status: 503 });
  }
  if (!config) return Response.json({ error: "Supabase no está configurado" }, { status: 503 });

  try {
    const rows = await createOracleElixirStore(config).readRowsForGame(gameId, league);
    if (rows.length === 0) return Response.json({ error: "Partida no encontrada" }, { status: 404 });
    return Response.json({ source: "oracleselixir", gameid: gameId, league, rows });
  } catch {
    return Response.json({ error: "No se pudieron leer los datos de Oracle's Elixir" }, { status: 502 });
  }
}