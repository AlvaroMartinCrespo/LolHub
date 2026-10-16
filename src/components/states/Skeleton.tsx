export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-border/60 ${className}`} />;
}

export function MatchCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4" aria-hidden>
      <Skeleton className="h-4 w-1/2" />
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2"><Skeleton className="h-8 w-8" /><Skeleton className="h-4 w-32" /></div>
        <div className="flex items-center gap-2"><Skeleton className="h-8 w-8" /><Skeleton className="h-4 w-28" /></div>
      </div>
      <Skeleton className="mt-4 h-3 w-40" />
    </div>
  );
}

/** Lista de esqueletos con anuncio accesible de carga. */
export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: count }, (_, i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </div>
  );
}
