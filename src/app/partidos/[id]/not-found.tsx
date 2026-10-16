import Link from "next/link";
import { EmptyState } from "@/components/states/EmptyState";

export default function NotFound() {
  return (
    <EmptyState
      title="Partido no encontrado"
      description="No existe o no está disponible con el plan actual."
      action={<Link href="/" className="text-accent">Volver al inicio</Link>}
    />
  );
}
