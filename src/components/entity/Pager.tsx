import Link from "next/link";

interface Props {
  basePath: string;
  page: number;
  hasNext: boolean;
  anchor?: string;
}

export function Pager({ basePath, page, hasNext, anchor }: Props) {
  const href = (p: number) => `${basePath}?page=${p}${anchor ? `#${anchor}` : ""}`;
  const cls = "min-h-10 inline-flex items-center rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  return (
    <nav aria-label="Paginación" className="flex items-center justify-center gap-3">
      {page > 1 ? <Link href={href(page - 1)} className={cls}>← Anterior</Link> : <span aria-hidden className="w-24" />}
      <span className="text-sm text-muted">Página {page}</span>
      {hasNext ? <Link href={href(page + 1)} className={cls}>Siguiente →</Link> : <span aria-hidden className="w-24" />}
    </nav>
  );
}
