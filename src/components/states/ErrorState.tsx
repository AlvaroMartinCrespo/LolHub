"use client";

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
      <p className="font-medium text-red-200">No se pudieron cargar los datos</p>
      <p className="mt-1 text-sm text-red-200/80">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-10 rounded-md border border-red-400/50 px-3 text-sm text-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
