/** Fecha externa → ISO 8601 UTC, o null si falta o no es válida. */
export function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function clean(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

export function joinName(first?: string | null, last?: string | null): string | null {
  const full = [clean(first), clean(last)].filter(Boolean).join(" ");
  return full || null;
}
