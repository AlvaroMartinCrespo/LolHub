import type { Match } from "@/types/domain";

/** Duración asumida de un partido para el evento (la fuente no da hora de fin de los futuros). */
export const ASSUMED_DURATION_MINUTES = 120;
export const ALARM_CHOICES = [0, 15, 30, 60] as const;

export interface IcsEvent {
  uid: string;
  start: string; // ISO
  end: string; // ISO
  summary: string;
  description?: string;
  url?: string;
  tentative?: boolean;
  /** Minutos de antelación del recordatorio; 0 o ausente = sin recordatorio */
  alarmMinutes?: number;
}

export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Pliega líneas a 75 octetos como exige RFC 5545 (la continuación empieza por un espacio). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
      limit = 74;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function formatUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildIcs(events: IcsEvent[], opts: { name: string; now?: Date }): string {
  const stamp = formatUtc((opts.now ?? new Date()).toISOString());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LoL Hub//Calendario//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.name)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatUtc(e.start)}`,
      `DTEND:${formatUtc(e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
      `STATUS:${e.tentative ? "TENTATIVE" : "CONFIRMED"}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.alarmMinutes && e.alarmMinutes > 0) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(e.summary)}`,
        `TRIGGER:-PT${Math.floor(e.alarmMinutes)}M`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Convierte un partido en evento. Devuelve null si no tiene fecha de inicio. */
export function matchToEvent(m: Match, origin: string, alarmMinutes = 15): IcsEvent | null {
  if (!m.startTime) return null;
  const start = new Date(m.startTime);
  const end = new Date(start.getTime() + ASSUMED_DURATION_MINUTES * 60_000);
  const title = m.sides ? `${m.sides[0].team.name} vs ${m.sides[1].team.name}` : m.name;
  const where = [m.league?.name, m.tournamentName].filter(Boolean).join(" · ");
  return {
    uid: `lolhub-match-${m.id}@lolhub`,
    start: start.toISOString(),
    end: end.toISOString(),
    summary: where ? `${title} (${where})` : title,
    description:
      `${m.bestOf !== null ? `Al mejor de ${m.bestOf}. ` : ""}` +
      `Hora de fin estimada (${ASSUMED_DURATION_MINUTES} min); la hora real puede variar.`,
    url: `${origin}/partidos/${m.id}`,
    tentative: m.status === "postponed",
    alarmMinutes,
  };
}

export function parseAlarm(raw: string | null): number {
  if (raw === null || raw.trim() === "") return 15; // sin parámetro → valor por defecto
  const n = Number(raw);
  return (ALARM_CHOICES as readonly number[]).includes(n) ? n : 15;
}
