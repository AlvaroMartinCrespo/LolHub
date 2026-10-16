import { afterEach } from "vitest";

// Entorno jsdom: stubs mínimos que usa next/link y limpieza del DOM entre pruebas.
if (typeof window !== "undefined") {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver ??= IO;
  afterEach(async () => {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  });
}
