import "server-only";
import { notFound } from "next/navigation";
import { DataSourceError } from "./errors";

export interface Loaded<T> {
  data: T | null;
  error: string | null;
}

/** Ejecuta una carga secundaria: si falla devuelve un mensaje en vez de romper la página. */
export async function safe<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    return { data: null, error: e instanceof DataSourceError ? e.userMessage : "Error inesperado." };
  }
}

/** Carga la entidad principal: 404 si no existe; otros errores se devuelven para mostrarlos. */
export async function loadEntity<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    if (e instanceof DataSourceError && e.kind === "not_found") notFound();
    return { data: null, error: e instanceof DataSourceError ? e.userMessage : "Error inesperado." };
  }
}
