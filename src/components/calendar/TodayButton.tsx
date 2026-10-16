"use client";

import { useRouter } from "next/navigation";

/** Lleva al día de hoy según la zona horaria del navegador. */
export function TodayButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        router.push(`/calendario?fecha=${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      }}
    >
      Hoy
    </button>
  );
}
