import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoL Hub",
  description: "Calendario, resultados, equipos y jugadores de League of Legends.",
};

export const viewport: Viewport = { themeColor: "#0a0e1a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-bg"
        >
          Saltar al contenido
        </a>
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-y-1 px-4 py-3">
            <Link href="/" className="text-lg font-semibold text-accent">LoL Hub</Link>
            <nav aria-label="Principal" className="ml-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link href="/" className="hover:text-accent">Inicio</Link>
              <Link href="/calendario" className="hover:text-accent">Calendario</Link>
              <Link href="/competiciones" className="hover:text-accent">Competiciones</Link>
              <Link href="/internacionales" className="hover:text-accent">Worlds/MSI</Link>
              <Link href="/comparar" className="hover:text-accent">Comparar</Link>
              <Link href="/favoritos" className="hover:text-accent">Favoritos</Link>
              <Link href="/estado" className="hover:text-accent">Estado</Link>
              <Link href="/fuentes" className="hover:text-accent">Fuentes</Link>
            </nav>
            <form method="get" action="/buscar" role="search" className="ml-auto">
              <label htmlFor="busqueda-global" className="sr-only">Buscar equipos, jugadores o ligas</label>
              <input
                id="busqueda-global"
                name="q"
                type="search"
                maxLength={60}
                placeholder="Buscar…"
                className="min-h-9 w-36 rounded-md border border-border bg-bg px-2 text-sm placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:w-48"
              />
            </form>
          </div>
        </header>
        <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 focus:outline-none">{children}</main>
      </body>
    </html>
  );
}
