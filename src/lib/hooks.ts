"use client";

import { useEffect, useState } from "react";

/** Devuelve `value` con retraso: solo cambia cuando el usuario deja de escribir `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
