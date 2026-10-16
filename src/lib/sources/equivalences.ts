import { z } from "zod";
import { SOURCE_IDS, type SourceId } from "./catalog";
import { normalizeKey } from "./adapters/base";
import type { EntityIdentity, EntityKind, EntityRef } from "@/types/sources";

/**
 * Tabla de equivalencias de identificadores entre fuentes (12.3.1).
 *
 * Regla del plan: «no fusionar por nombre sin revisar». Por eso:
 *  - El ID canónico es siempre el de PandaScore (fuente principal).
 *  - Una coincidencia por nombre solo genera una PROPUESTA (`proposed`); resuelve únicamente lo `confirmed`,
 *    y confirmar exige revisor y fecha (`reviewedBy`, `reviewedAt`).
 *  - Lo `rejected` se recuerda para no volver a proponer el mismo par.
 *  - `validateEquivalences` detecta contradicciones (un externo con dos canónicos, dos externos de la misma fuente para un canónico).
 * Módulo puro: sin red, sin disco. El fichero `data/equivalences.json` y la tabla Supabase (0002) son su persistencia.
 */
export const CANONICAL_SOURCE: SourceId = "pandascore";

export const ENTITY_KINDS = ["team", "player", "tournament", "league"] as const satisfies readonly EntityKind[];

const refSchema = z.object({
  source: z.enum(SOURCE_IDS),
  kind: z.enum(ENTITY_KINDS),
  externalId: z.string().min(1),
});

export const equivalenceSchema = z.object({
  canonical: refSchema,
  external: refSchema,
  status: z.enum(["confirmed", "proposed", "rejected"]),
  method: z.enum(["manual", "suggested"]),
  /** Por qué se cree que son lo mismo (o por qué no). Obligatorio para confirmar o rechazar. */
  evidence: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
});

export const equivalencesFileSchema = z.object({
  version: z.literal(1),
  entries: z.array(equivalenceSchema),
});

export type Equivalence = z.infer<typeof equivalenceSchema>;
export type EquivalenceStatus = Equivalence["status"];

export interface Issue {
  index: number;
  message: string;
}

const refKey = (r: EntityRef) => `${r.source}|${r.kind}|${r.externalId}`;
const pairKey = (e: Pick<Equivalence, "canonical" | "external">) => `${refKey(e.canonical)}=>${refKey(e.external)}`;

/** Comprueba la coherencia interna de la tabla. Devuelve la lista de problemas (vacía = válida). */
export function validateEquivalences(entries: readonly Equivalence[]): Issue[] {
  const issues: Issue[] = [];
  const seenPairs = new Map<string, number>();
  const confirmedByExternal = new Map<string, number>();
  const confirmedByCanonicalSource = new Map<string, number>();

  entries.forEach((e, index) => {
    const bad = (message: string) => issues.push({ index, message });
    if (e.canonical.source !== CANONICAL_SOURCE) bad(`El ID canónico debe ser de ${CANONICAL_SOURCE}`);
    if (e.external.source === CANONICAL_SOURCE) bad("La entidad externa no puede ser de la fuente canónica");
    if (e.canonical.kind !== e.external.kind) bad("canonical y external deben ser del mismo tipo");

    const dup = seenPairs.get(pairKey(e));
    if (dup !== undefined) bad(`Par duplicado (ya está en la entrada ${dup})`);
    else seenPairs.set(pairKey(e), index);

    if (e.status !== "proposed") {
      if (!e.reviewedBy?.trim() || !e.reviewedAt || Number.isNaN(Date.parse(e.reviewedAt))) {
        bad("Una equivalencia confirmada o rechazada exige reviewedBy y reviewedAt válidos");
      }
      if (!e.evidence.trim()) bad("Una equivalencia confirmada o rechazada exige evidencia");
    }
    if (e.status === "proposed" && e.method === "manual") bad("Una propuesta manual no tiene sentido: confírmala o recházala");

    if (e.status === "confirmed") {
      const ek = refKey(e.external);
      const other = confirmedByExternal.get(ek);
      if (other !== undefined) bad(`El externo ya está confirmado con otro canónico (entrada ${other})`);
      else confirmedByExternal.set(ek, index);

      const ck = `${refKey(e.canonical)}|${e.external.source}`;
      const other2 = confirmedByCanonicalSource.get(ck);
      if (other2 !== undefined) bad(`El canónico ya tiene un externo confirmado de ${e.external.source} (entrada ${other2})`);
      else confirmedByCanonicalSource.set(ck, index);
    }
  });
  return issues;
}

/** Valida y devuelve las entradas o lanza con todos los problemas. Úsalo al cargar el fichero. */
export function loadEquivalences(raw: unknown): Equivalence[] {
  const parsed = equivalencesFileSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Tabla de equivalencias con formato no válido");
  const issues = validateEquivalences(parsed.data.entries);
  if (issues.length > 0) throw new Error(`Tabla de equivalencias incoherente: ${issues.map((i) => `#${i.index} ${i.message}`).join("; ")}`);
  return parsed.data.entries;
}

/** ID canónico de una entidad externa. Solo cuenta lo CONFIRMADO; propuestas y rechazos nunca resuelven. */
export function resolveCanonical(entries: readonly Equivalence[], external: EntityRef): EntityRef | null {
  const k = refKey(external);
  const hit = entries.find((e) => e.status === "confirmed" && refKey(e.external) === k);
  return hit ? hit.canonical : null;
}

/** ID confirmado de una fuente para una entidad canónica. */
export function resolveExternal(entries: readonly Equivalence[], canonical: EntityRef, source: SourceId): EntityRef | null {
  const k = refKey(canonical);
  const hit = entries.find((e) => e.status === "confirmed" && e.external.source === source && refKey(e.canonical) === k);
  return hit ? hit.external : null;
}

export interface ReviewInput {
  reviewedBy: string;
  evidence: string;
  now?: () => Date;
}

/** Confirma (o crea ya confirmada) una equivalencia tras revisión humana. No modifica el array original. */
export function confirmEquivalence(
  entries: readonly Equivalence[], canonical: EntityRef, external: EntityRef, review: ReviewInput,
): Equivalence[] {
  return decide(entries, canonical, external, "confirmed", review);
}

export function rejectEquivalence(
  entries: readonly Equivalence[], canonical: EntityRef, external: EntityRef, review: ReviewInput,
): Equivalence[] {
  return decide(entries, canonical, external, "rejected", review);
}

function decide(
  entries: readonly Equivalence[], canonical: EntityRef, external: EntityRef, status: "confirmed" | "rejected", review: ReviewInput,
): Equivalence[] {
  const reviewer = review.reviewedBy.trim();
  const evidence = review.evidence.trim();
  if (!reviewer) throw new Error("Hace falta indicar quién revisa");
  if (!evidence) throw new Error("Hace falta indicar la evidencia de la decisión");
  const at = (review.now ?? (() => new Date()))().toISOString();
  const target = { canonical, external };
  const existing = entries.find((e) => pairKey(e) === pairKey(target));
  const decided: Equivalence = {
    canonical, external, status, method: existing?.method === "suggested" ? "suggested" : "manual",
    evidence, reviewedBy: reviewer, reviewedAt: at,
  };
  const next = existing ? entries.map((e) => (e === existing ? decided : e)) : [...entries, decided];
  const issues = validateEquivalences(next);
  if (issues.length > 0) throw new Error(issues.map((i) => i.message).join("; "));
  return next;
}

// ── Propuestas por similitud (nunca resuelven) ─────────────
export interface Candidate {
  canonical: EntityIdentity;
  score: number;
  reasons: string[];
}

export interface Proposal {
  external: EntityIdentity;
  candidates: Candidate[];
  /** true si hay más de un candidato con la mejor puntuación: hay que decidir a mano. */
  ambiguous: boolean;
}

/**
 * Sugiere candidatos canónicos para cada identidad externa comparando nombre y siglas normalizados.
 * Omite pares ya decididos (confirmados o rechazados) y externos ya resueltos. Es una ayuda para el revisor:
 * el resultado NUNCA se aplica solo.
 */
export function suggestEquivalences(
  canonicals: readonly EntityIdentity[], externals: readonly EntityIdentity[], entries: readonly Equivalence[] = [],
): Proposal[] {
  const decidedPairs = new Set(entries.filter((e) => e.status !== "proposed").map(pairKey));
  const resolved = new Set(entries.filter((e) => e.status === "confirmed").map((e) => refKey(e.external)));
  const proposals: Proposal[] = [];
  for (const ext of externals) {
    if (resolved.has(refKey(ext))) continue;
    const nameKey = normalizeKey(ext.name);
    const accKey = normalizeKey(ext.acronym);
    const candidates: Candidate[] = [];
    for (const can of canonicals) {
      if (can.kind !== ext.kind || can.source !== CANONICAL_SOURCE) continue;
      if (decidedPairs.has(pairKey({ canonical: can, external: ext }))) continue;
      const reasons: string[] = [];
      let score = 0;
      if (nameKey && normalizeKey(can.name) === nameKey) { score += 3; reasons.push("nombre idéntico (normalizado)"); }
      if (accKey && can.acronym && normalizeKey(can.acronym) === accKey) { score += 2; reasons.push("siglas idénticas"); }
      if (accKey && nameKey && normalizeKey(can.name) === accKey) { score += 1; reasons.push("las siglas externas coinciden con el nombre canónico"); }
      if (score > 0) candidates.push({ canonical: can, score, reasons });
    }
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => b.score - a.score);
    proposals.push({ external: ext, candidates, ambiguous: candidates.filter((c) => c.score === candidates[0].score).length > 1 });
  }
  return proposals;
}

/** Convierte una propuesta aceptada para estudio en una entrada `proposed` (sigue sin resolver nada). */
export function toProposedEntry(external: EntityIdentity, candidate: Candidate): Equivalence {
  return {
    canonical: { source: candidate.canonical.source, kind: candidate.canonical.kind, externalId: candidate.canonical.externalId },
    external: { source: external.source, kind: external.kind, externalId: external.externalId },
    status: "proposed",
    method: "suggested",
    evidence: `Sugerida: ${candidate.reasons.join("; ")}`,
    reviewedBy: null,
    reviewedAt: null,
  };
}
