import Link from "next/link";
import { ErrorState } from "../states/ErrorState";

export function PageError({ message }: { message: string }) {
  return (
    <div className="space-y-4">
      <ErrorState message={message} />
      <Link href="/" className="text-accent">← Volver al inicio</Link>
    </div>
  );
}
