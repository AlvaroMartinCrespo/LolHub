"use client";

import { useState } from "react";
import { initials } from "@/lib/format/text";

interface Props {
  src: string | null;
  /** Texto alternativo descriptivo. Usa "" si la imagen es decorativa. */
  alt: string;
  /** Nombre para generar iniciales de reserva */
  fallbackName: string;
  size: number;
  rounded?: "md" | "full";
}

/**
 * Imagen con tamaño reservado (evita saltos de layout), carga diferida,
 * texto alternativo y fallback de iniciales si falta o falla.
 */
export function SafeImage({ src, alt, fallbackName, size, rounded = "md" }: Props) {
  const [failed, setFailed] = useState(false);
  const radius = rounded === "full" ? "rounded-full" : "rounded-md";
  const box = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        style={{ ...box, fontSize: Math.max(10, size / 3) }}
        className={`inline-flex shrink-0 items-center justify-center bg-border font-semibold text-muted ${radius}`}
      >
        {initials(fallbackName)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- hosts de imagen aún sin verificar (ver docs/samples)
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={box}
      className={`shrink-0 bg-border object-contain ${radius}`}
    />
  );
}
