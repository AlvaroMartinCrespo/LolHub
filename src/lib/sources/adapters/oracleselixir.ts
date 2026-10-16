import type { EntityIdentity, PlayerGameStat, Side, SourceMeta, StatGame } from "@/types/sources";
import { kindsOf } from "../routing";
import { blankToNull, makeMeta, type SourceAdapter } from "./base";

/**
 * Adaptador de Oracle's Elixir. NO es una API: son CSV anuales con una fila por jugador (participantid 1–10)
 * y una por equipo (participantid 100 azul / 200 rojo) y mapa. Este módulo es puro (sin red ni disco): recibe el
 * texto del CSV y devuelve el modelo interno. La carga de producción es manual en Supabase y conserva las filas
 * originales; este parser se reserva para auditoría y normalización futura.
 *
 * Nombres de columna: el diccionario oficial publicado (2019) usa `player`, `team`, `k`, `d`, `a`, `dmgtochamps`…, y avisa
 * de que «la estructura puede cambiar»; los CSV recientes usan `playername`, `teamname`, `kills`, `deaths`, `assists`,
 * `damagetochampions`… Se aceptan ambos juegos de nombres y se exigen solo las columnas imprescindibles.
 * La unidad de `gamelength` (segundos en los CSV recientes, minutos en el diccionario antiguo) es una opción explícita
 * y los resultados implausibles se marcan en `warnings` en lugar de corregirse en silencio.
 */
export type GameLengthUnit = "seconds" | "minutes";

export interface ParseOptions {
  gameLengthUnit?: GameLengthUnit;
  now?: () => Date;
}

export type WarningCode =
  | "missing_team_rows" | "wrong_player_count" | "mixed_game_data" | "suspicious_length" | "partial_data" | "duplicate_participant";

export interface ParseWarning {
  gameId: string;
  code: WarningCode;
  detail: string;
}

export interface ParseResult {
  games: StatGame[];
  /** Filas sin `gameid`/`participantid` válidos, descartadas. */
  skippedRows: number;
  warnings: ParseWarning[];
  /** Columnas obligatorias que faltan: si hay alguna, `games` está vacío. */
  missingColumns: string[];
}

/** Al menos una columna de cada grupo debe existir en la cabecera. */
const REQUIRED: readonly (readonly string[])[] = [
  ["gameid"], ["participantid"], ["side"], ["result"], ["gamelength"],
];

// ── CSV (RFC 4180) ─────────────────────────────────────────
/** Itera los registros de un CSV: comillas dobles, comillas escapadas ("") y saltos de línea dentro de campos. */
export function* iterateCsv(text: string): Generator<string[]> {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; // BOM
  const n = text.length;
  let field = "";
  let row: string[] = [];
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

// ── Utilidades de celda ────────────────────────────────────
const num = (v: string | undefined): number | null => {
  const t = v?.trim();
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};
const int = (v: string | undefined): number | null => {
  const x = num(v);
  return x === null ? null : Math.trunc(x);
};

type Row = Record<string, string>;
const pick = (row: Row, ...names: string[]): string | undefined => {
  for (const n of names) if (n in row) return row[n];
  return undefined;
};

const sideOf = (v: string | undefined): Side | null => {
  const s = v?.trim().toLowerCase();
  return s === "blue" ? "blue" : s === "red" ? "red" : null;
};

const flag = (v: string | undefined): boolean | null => {
  const t = v?.trim().toLowerCase();
  if (t === "1" || t === "true") return true;
  if (t === "0" || t === "false") return false;
  return null;
};

/** Solo se aceptan fechas con forma YYYY-MM-DD; el resto (p. ej. formato Excel antiguo) queda en null. */
const dateOnly = (v: string | undefined): string | null => {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/.exec(v?.trim() ?? "");
  return m ? m[1] : null;
};

const MIN_PLAUSIBLE_S = 5 * 60;
const MAX_PLAUSIBLE_S = 90 * 60;

function playerFrom(row: Row, participantId: number, side: Side): PlayerGameStat {
  return {
    participantId,
    side,
    position: blankToNull(pick(row, "position")),
    playerExternalId: blankToNull(pick(row, "playerid")),
    playerName: blankToNull(pick(row, "playername", "player")),
    teamExternalId: blankToNull(pick(row, "teamid")),
    teamName: blankToNull(pick(row, "teamname", "team")),
    champion: blankToNull(pick(row, "champion")),
    won: flag(pick(row, "result")),
    kills: int(pick(row, "kills", "k")),
    deaths: int(pick(row, "deaths", "d")),
    assists: int(pick(row, "assists", "a")),
    totalGold: num(pick(row, "totalgold")),
    damageToChampions: num(pick(row, "damagetochampions", "dmgtochamps")),
    minionKills: int(pick(row, "minionkills")),
    monsterKills: int(pick(row, "monsterkills")),
    wardsPlaced: int(pick(row, "wardsplaced", "wards")),
  };
}

/** Parsea el CSV completo y agrupa por `gameid`. */
export function parseOraclesElixirCsv(text: string, options: ParseOptions = {}): ParseResult {
  const unit: GameLengthUnit = options.gameLengthUnit ?? "seconds";
  const meta: SourceMeta = makeMeta("oracleselixir", options.now);
  const it = iterateCsv(text);
  const head = it.next();
  const header = head.done ? [] : head.value.map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((g) => !g.some((c) => header.includes(c))).map((g) => g.join("|"));
  if (missing.length > 0) return { games: [], skippedRows: 0, warnings: [], missingColumns: missing };

  const byGame = new Map<string, Row[]>();
  let skipped = 0;
  for (const cells of it) {
    if (cells.length === 1 && cells[0].trim() === "") continue; // línea en blanco
    const row: Row = {};
    for (let c = 0; c < header.length; c++) row[header[c]] = cells[c] ?? "";
    const gid = row.gameid?.trim();
    if (!gid || int(row.participantid) === null) { skipped++; continue; }
    const list = byGame.get(gid);
    if (list) list.push(row); else byGame.set(gid, [row]);
  }

  const warnings: ParseWarning[] = [];
  const games: StatGame[] = [];
  for (const [gid, rows] of byGame) {
    const warn = (code: WarningCode, detail: string) => warnings.push({ gameId: gid, code, detail });
    const teamRows = rows.filter((r) => [100, 200].includes(int(r.participantid) ?? -1));
    const playerRows = rows.filter((r) => { const p = int(r.participantid) ?? -1; return p >= 1 && p <= 10; });
    const ids = playerRows.map((r) => int(r.participantid));
    if (new Set(ids).size !== ids.length) warn("duplicate_participant", "Hay participantid repetidos");
    if (playerRows.length !== 10) warn("wrong_player_count", `${playerRows.length} filas de jugador (se esperaban 10)`);
    const blueRow = teamRows.find((r) => int(r.participantid) === 100);
    const redRow = teamRows.find((r) => int(r.participantid) === 200);
    if (!blueRow || !redRow) warn("missing_team_rows", "Falta la fila del equipo azul o rojo");

    const first = rows[0];
    // Una misma partida no debería mezclar ligas/años; si pasa, se avisa (los datos podrían ser de dos juegos distintos).
    for (const col of ["league", "year", "split", "date"]) {
      if (new Set(rows.map((r) => r[col] ?? "")).size > 1) { warn("mixed_game_data", `Valores distintos en «${col}»`); break; }
    }

    const complete = flag(pick(first, "datacomplete"));
    if (complete === false) warn("partial_data", "La fuente marca la partida como parcial (datacomplete = 0)");

    const lengthRaw = num(pick(blueRow ?? first, "gamelength"));
    const durationSeconds = lengthRaw === null ? null : Math.round(unit === "minutes" ? lengthRaw * 60 : lengthRaw);
    if (durationSeconds !== null && (durationSeconds < MIN_PLAUSIBLE_S || durationSeconds > MAX_PLAUSIBLE_S)) {
      warn("suspicious_length", `Duración ${durationSeconds} s fuera de 5–90 min con unidad «${unit}»: revisa la unidad de gamelength`);
    }

    const blueWon = blueRow ? flag(pick(blueRow, "result")) : null;
    const redWon = redRow ? flag(pick(redRow, "result")) : null;
    const winnerSide: Side | null = blueWon === true && redWon !== true ? "blue" : redWon === true && blueWon !== true ? "red" : null;

    const sideFor = (r: Row): Side => sideOf(r.side) ?? (int(r.participantid)! <= 5 ? "blue" : "red");
    games.push({
      meta,
      externalId: gid,
      league: blankToNull(first.league),
      year: int(first.year),
      split: blankToNull(first.split),
      playoffs: flag(first.playoffs),
      playedOn: dateOnly(first.date),
      gameNumber: int(first.game),
      patch: blankToNull(pick(first, "patch", "patchno")),
      dataComplete: complete,
      blueTeam: {
        externalId: blankToNull(blueRow ? pick(blueRow, "teamid") : undefined),
        name: blankToNull(blueRow ? pick(blueRow, "teamname", "team") : undefined),
      },
      redTeam: {
        externalId: blankToNull(redRow ? pick(redRow, "teamid") : undefined),
        name: blankToNull(redRow ? pick(redRow, "teamname", "team") : undefined),
      },
      winnerSide,
      durationSeconds,
      players: playerRows
        .map((r) => playerFrom(r, int(r.participantid)!, sideFor(r)))
        .sort((a, b) => a.participantId - b.participantId),
    });
  }
  games.sort((a, b) => a.externalId.localeCompare(b.externalId));
  return { games, skippedRows: skipped, warnings, missingColumns: [] };
}

/** Identidades de equipos y jugadores presentes en las partidas (para la tabla de equivalencias). */
export function gameIdentities(games: StatGame[]): EntityIdentity[] {
  const out = new Map<string, EntityIdentity>();
  const add = (kind: "team" | "player", id: string | null, name: string | null, region: string | null) => {
    const externalId = id ?? name;
    if (!externalId || !name) return;
    out.set(`${kind}:${externalId}`, { source: "oracleselixir", kind, externalId, name, acronym: null, region });
  };
  for (const g of games) {
    add("team", g.blueTeam.externalId, g.blueTeam.name, g.league);
    add("team", g.redTeam.externalId, g.redTeam.name, g.league);
    for (const p of g.players) add("player", p.playerExternalId, p.playerName, g.league);
  }
  return [...out.values()];
}

export interface OraclesElixirAdapter extends SourceAdapter {
  readonly id: "oracleselixir";
  parse(csv: string, options?: ParseOptions): ParseResult;
}

export const oraclesElixirAdapter: OraclesElixirAdapter = {
  id: "oracleselixir",
  kinds: kindsOf("oracleselixir"),
  parse: parseOraclesElixirCsv,
};
