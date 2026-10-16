"use client";

import { useEffect, useState } from "react";

interface Props {
  iso: string | null;
  /** Texto si no hay fecha */
  fallback?: string;
}

const FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
};

/**
 * Muestra una fecha ISO en la zona horaria del navegador.
 * Se calcula tras montar para evitar diferencias de hidratación servidor/cliente.
 */
export function LocalTime({ iso, fallback = "Fecha por confirmar" }: Props) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (iso) setText(new Intl.DateTimeFormat(undefined, FORMAT).format(new Date(iso)));
  }, [iso]);

  if (!iso) return <span className="text-muted">{fallback}</span>;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text ?? "\u00A0"}
    </time>
  );
}
