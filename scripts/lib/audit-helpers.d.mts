export function iterateCsv(text: string): Generator<string[]>;
export const OE_REQUIRED: string[][];
export const OE_OPTIONAL: string[][];
export interface OracleSummary {
  columns: string[];
  rows: number;
  games: number;
  missingRequired: string[];
  optionalFound: string[];
  optionalMissing: string[];
  participantIds: Record<string, number>;
  resultValues: Record<string, number>;
  dataCompleteValues: Record<string, number>;
  gamelength: { teamRowsMeasured: number; min: number | null; max: number | null; median: number | null; suggestedUnit: "seconds" | "minutes" | null };
  dateSamples: string[];
  sampleRows: Record<string, string>[];
}
export function summarizeOraclesElixir(text: string, opts?: { sampleRows?: number; maxDistinct?: number }): OracleSummary;
export function compareFields(requested: string[], actual: string[]): { present: string[]; missing: string[] };
export function detectMediaWikiError(body: unknown): { code: string; rateLimited: boolean } | null;
export function findFirst(value: unknown, keys: string[], depth?: number): string | undefined;
export function rateLimitHeaders(headers: Headers): Record<string, string>;
export function keysOf(obj: unknown, path?: string, acc?: Set<string>): Set<string>;
