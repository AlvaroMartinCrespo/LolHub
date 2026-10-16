import Link from "next/link";
import { EmptyState } from "../states/EmptyState";

export function EntityNotFound({ what }: { what: string }) {
  return (
    <EmptyState
      title={`${what} no encontrado`}
      description="No existe o no está disponible con el plan actual."
      action={<Link href="/" className="text-accent">Volver al inicio</Link>}
    />
  );
}
