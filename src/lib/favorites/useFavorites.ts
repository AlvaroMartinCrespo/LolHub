"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  EMPTY_FAVORITES, STORAGE_KEY, isFavoriteTeam, parseFavorites, serializeFavorites, toggleTeam,
  type FavoriteTeam, type Favorites,
} from "./store";

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: Favorites = EMPTY_FAVORITES;
/** Si localStorage no está disponible (modo privado, bloqueado), los favoritos viven en memoria. */
let memoryFallback: Favorites | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): Favorites {
  if (memoryFallback) return memoryFallback;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseFavorites(raw);
  }
  return cachedValue;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: Favorites): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeFavorites(next));
    memoryFallback = null;
  } catch {
    memoryFallback = next;
  }
  listeners.forEach((l) => l());
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_FAVORITES);
  const toggle = useCallback((team: FavoriteTeam) => write(toggleTeam(getSnapshot(), team)), []);
  const isFavorite = useCallback((id: number) => isFavoriteTeam(favorites, id), [favorites]);
  return { favorites, toggle, isFavorite };
}
