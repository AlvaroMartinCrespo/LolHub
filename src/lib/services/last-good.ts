import "server-only";

/**
 * Últimos datos válidos por URL, en memoria de la instancia del servidor.
 * Es un respaldo «best effort»: en serverless cada instancia tiene su propia copia
 * y se pierde al reciclarse. Para persistencia real haría falta una base de datos (ver docs/despliegue.md).
 */
const MAX_ENTRIES = 300;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface Entry<T> {
  value: T;
  savedAt: number;
}
const store = new Map<string, Entry<unknown>>();

export function remember<T>(key: string, value: T, now = Date.now()): void {
  store.delete(key); // reinserta al final (más reciente)
  store.set(key, { value, savedAt: now });
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function recall<T>(key: string, now = Date.now()): { value: T; savedAt: number } | null {
  const e = store.get(key);
  if (!e) return null;
  if (now - e.savedAt > MAX_AGE_MS) {
    store.delete(key);
    return null;
  }
  return e as Entry<T>;
}

/** Entradas guardadas (de la más reciente a la más antigua), sin exponer cuerpos. */
export function snapshot(now = Date.now()): { key: string; savedAt: number }[] {
  return [...store.entries()]
    .filter(([, e]) => now - e.savedAt <= MAX_AGE_MS)
    .map(([key, e]) => ({ key, savedAt: e.savedAt }))
    .sort((a, b) => b.savedAt - a.savedAt);
}
