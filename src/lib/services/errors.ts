export type DataErrorKind =
  | "config" | "unauthorized" | "forbidden" | "not_found"
  | "rate_limited" | "server" | "network" | "invalid"
  /** La política de fuentes (12.2) prohíbe esta consulta (por visita, integración futura…). */
  | "blocked";

export class DataSourceError extends Error {
  constructor(
    readonly kind: DataErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "DataSourceError";
  }

  /** Mensaje apto para mostrar al usuario (sin detalles internos). */
  get userMessage(): string {
    switch (this.kind) {
      case "config": return "El servicio de datos no está configurado.";
      case "unauthorized": return "Credenciales de la fuente de datos no válidas.";
      case "forbidden": return "Este dato no está disponible con el plan actual.";
      case "not_found": return "No se encontró lo que buscas.";
      case "rate_limited": return "Se alcanzó el límite de peticiones. Inténtalo en unos minutos.";
      case "server": return "La fuente de datos tiene problemas ahora mismo.";
      case "network": return "No se pudo conectar con la fuente de datos.";
      case "invalid": return "La fuente de datos devolvió un formato inesperado.";
      case "blocked": return "Esta fuente no puede consultarse en este momento.";
    }
  }
}

export function kindFromStatus(status: number): DataErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return status >= 500 ? "server" : "invalid";
}

/** Solo estos casos merecen reintento. */
export const isRetryable = (kind: DataErrorKind) =>
  kind === "rate_limited" || kind === "server" || kind === "network";
