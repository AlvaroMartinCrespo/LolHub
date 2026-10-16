"use client";

import { useState } from "react";
import type { Match } from "@/types/domain";
import { MatchCard } from "../MatchCard";

const STEP = 24;

/** Lista con «Mostrar más» para no renderizar cientos de tarjetas de golpe. */
export function MatchList({ matches }: { matches: Match[] }) {
  const [shown, setShown] = useState(STEP);
  return (
    <>
      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {matches.length} {matches.length === 1 ? "partido" : "partidos"}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matches.slice(0, shown).map((m) => (
          <li key={m.id}><MatchCard match={m} href={`/partidos/${m.id}`} /></li>
        ))}
      </ul>
      {shown < matches.length && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + STEP)}
            className="min-h-10 rounded-md border border-border bg-surface px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Mostrar más ({matches.length - shown} restantes)
          </button>
        </div>
      )}
    </>
  );
}
