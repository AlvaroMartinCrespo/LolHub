// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import type { ReactElement } from "react";
import { finished, makeMatch, team } from "./fixtures";
import type { Match, Player, Standing, Team } from "@/types/domain";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { MatchCard } from "@/components/MatchCard";
import { TeamCard } from "@/components/TeamCard";
import { PlayerCard } from "@/components/PlayerCard";
import { MultiSelect } from "@/components/filters/MultiSelect";
import { DateFilter } from "@/components/filters/DateFilter";
import { PeriodFilter } from "@/components/filters/PeriodFilter";
import { SafeImage } from "@/components/ui/SafeImage";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";
import { ListSkeleton } from "@/components/states/Skeleton";
import { StaleNotice } from "@/components/states/StaleNotice";
import { SearchBox } from "@/components/home/SearchBox";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { StatsFilterForm } from "@/components/stats/StatsFilterForm";
import { SampleNotice, SplitBar, FormStrip } from "@/components/stats/parts";
import { StandingsTable } from "@/components/entity/StandingsTable";
import { Pager } from "@/components/entity/Pager";
import { GamesList } from "@/components/match/GamesList";
import { MatchHeader } from "@/components/match/MatchHeader";
import { computeTeamStats } from "@/lib/stats/formulas";
import { EMPTY_STATS_FILTERS } from "@/lib/stats/filters";

/** axe sin reglas que jsdom no puede evaluar (contraste: ver contrast.test.ts) ni de página completa. */
async function expectAccessible(ui: ReactElement) {
  const { container } = render(ui);
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`);
  expect(summary).toEqual([]);
}

const live = makeMatch({ id: 1, status: "live", startTime: new Date().toISOString(),
  sides: [{ team: team(1, "Alpha"), score: 1 }, { team: team(2, "Beta"), score: 0 }] });
const done = finished(2, 1, 2, 1);
const upcoming = makeMatch({ id: 3, startTime: new Date(Date.now() + 86_400_000).toISOString() });
const tbd = makeMatch({ id: 4, sides: null });

describe("accesibilidad (axe)", () => {
  it("tarjetas de partido en todos los estados", async () => {
    await expectAccessible(
      <ul>{[live, done, upcoming, tbd].map((m) => <li key={m.id}><MatchCard match={m} href={`/partidos/${m.id}`} /></li>)}</ul>,
    );
  });
  it("tarjetas de equipo y jugador", async () => {
    const t: Team = { id: 1, name: "Alpha", acronym: "ALP", imageUrl: null, region: "ES", roster: [] };
    const p: Player = { id: 1, name: "Pepe", fullName: null, role: "mid", nationality: "ES", imageUrl: null, active: true, team: null };
    await expectAccessible(<div><TeamCard team={t} href="/equipos/1" /><PlayerCard player={p} href="/jugadores/1" /></div>);
  });
  it("filtros", async () => {
    await expectAccessible(
      <div>
        <MultiSelect label="Liga" options={[{ value: "1", label: "Uno" }]} selected={[]} onChange={() => {}} />
        <DateFilter value={{ preset: "all", date: null }} onChange={() => {}} />
        <PeriodFilter value="all" onChange={() => {}} />
        <SearchBox onSearch={() => {}} />
      </div>,
    );
  });
  it("selector abierto", async () => {
    const { container } = render(<MultiSelect label="Liga" options={[{ value: "1", label: "Uno" }]} selected={["1"]} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /liga/i }));
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
  it("estados: carga, vacío, error y desactualizado", async () => {
    await expectAccessible(
      <div>
        <ListSkeleton count={2} />
        <EmptyState title="Vacío" description="Nada" />
        <ErrorState message="Falló" onRetry={() => {}} />
        <StaleNotice lastUpdatedIso="2026-10-01T10:00:00Z" />
      </div>,
    );
  });
  it("tablas: clasificación y mapas", async () => {
    const st: Standing[] = [{ rank: 1, team: team(1, "Alpha"), wins: 5, losses: 1, ties: null }];
    await expectAccessible(<div><StandingsTable standings={st} /><GamesList match={done} /></div>);
  });
  it("cabecera de partido y paginación", async () => {
    await expectAccessible(<div><MatchHeader match={done} /><Pager basePath="/x" page={2} hasNext /></div>);
  });
  it("formulario de estadísticas y paneles", async () => {
    const stats = computeTeamStats([done], 1);
    await expectAccessible(
      <div>
        <StatsFilterForm action="/equipos/1/estadisticas" options={{ tournaments: ["A"], seasons: ["S"], formats: ["3"] }} value={EMPTY_STATS_FILTERS} />
        <SampleNotice stats={stats} />
        <SplitBar label="Series" wins={6} losses={4} reliable />
        <FormStrip form={["W", "L"]} />
      </div>,
    );
  });
  it("portada completa", async () => {
    await expectAccessible(<HomeDashboard upcoming={[upcoming, live]} recent={[done]} upcomingError={null} recentError={null} />);
  });
});

describe("imágenes", () => {
  it("fallback con iniciales si no hay URL", () => {
    render(<SafeImage src={null} alt="Logo de Fnatic" fallbackName="Fnatic Esports" size={32} />);
    expect(screen.getByRole("img", { name: "Logo de Fnatic" })).toHaveProperty("textContent", "FE");
  });
  it("fallback si la imagen falla; tamaño reservado y carga diferida", () => {
    const { container } = render(<SafeImage src="https://x.test/a.png" alt="Logo" fallbackName="Zeta" size={40} />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("width")).toBe("40");
    expect(img.getAttribute("loading")).toBe("lazy");
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("ZE");
  });
});

describe("MultiSelect (teclado y comportamiento)", () => {
  function setup(selected: string[] = []) {
    const onChange = vi.fn();
    render(<MultiSelect label="Liga" options={[{ value: "1", label: "Uno" }, { value: "2", label: "Dos" }]} selected={selected} onChange={onChange} />);
    return onChange;
  }
  it("muestra «Todas» sin selección y resume la selección", () => {
    setup();
    expect(screen.getByRole("button", { name: /todas/i })).toBeTruthy();
    render(<MultiSelect label="Equipo" options={[{ value: "1", label: "Uno" }, { value: "2", label: "Dos" }]} selected={["1", "2"]} onChange={() => {}} />);
    expect(screen.getByText("2 seleccionadas")).toBeTruthy();
  });
  it("selecciona, quita y restablece", () => {
    const onChange = setup(["1"]);
    fireEvent.click(screen.getByRole("button", { name: /liga/i }));
    fireEvent.click(screen.getByLabelText("Dos"));
    expect(onChange).toHaveBeenLastCalledWith(["1", "2"]);
    fireEvent.click(screen.getByLabelText("Uno"));
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
  it("Escape cierra y devuelve el foco al botón", () => {
    setup();
    const btn = screen.getByRole("button", { name: /liga/i });
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(screen.getByRole("group"), { key: "Escape" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(btn);
  });
});

describe("búsqueda con debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("solo notifica tras 250 ms sin teclear", () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);
    const input = screen.getByRole("searchbox");
    act(() => { vi.advanceTimersByTime(300); });
    onSearch.mockClear();
    fireEvent.change(input, { target: { value: "ab" } });
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.change(input, { target: { value: "abc" } });
    act(() => { vi.advanceTimersByTime(200); });
    expect(onSearch).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(100); });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("abc");
  });
});

describe("portada: filtros extremo a extremo", () => {
  const mk = (id: number, league: number, name: string): Match =>
    makeMatch({ id, name, startTime: new Date(Date.now() + id * 3_600_000).toISOString(),
      league: { id: league, name: `Liga ${league}`, slug: null, imageUrl: null } });
  const matches = [mk(1, 1, "Uno vs Dos"), mk(2, 2, "Tres vs Cuatro"), mk(3, 1, "Cinco vs Seis")];

  it("estado vacío y error por sección", () => {
    render(<HomeDashboard upcoming={[]} recent={[]} upcomingError="Falló A" recentError={null} />);
    expect(screen.getByRole("alert").textContent).toContain("Falló A");
    expect(screen.getByText("No hay resultados recientes")).toBeTruthy();
  });

  it("filtra por liga y permite restablecer", () => {
    render(<HomeDashboard upcoming={matches} recent={[]} upcomingError={null} recentError={null} />);
    const section = screen.getByRole("region", { name: "Próximos partidos" });
    expect(within(section).getByText("3 partidos")).toBeTruthy();
    fireEvent.click(within(section).getByRole("button", { name: /liga/i }));
    fireEvent.click(within(section).getByLabelText("Liga 2"));
    expect(within(section).getByText("1 partido")).toBeTruthy();
    fireEvent.click(within(section).getByRole("button", { name: "Restablecer filtros" }));
    expect(within(section).getByText("3 partidos")).toBeTruthy();
  });

  it("sin coincidencias muestra estado vacío con restablecer", () => {
    render(<HomeDashboard upcoming={matches} recent={[]} upcomingError={null} recentError={null} />);
    const section = screen.getByRole("region", { name: "Próximos partidos" });
    fireEvent.change(within(section).getByLabelText("Día"), { target: { value: "2000-01-01" } });
    expect(within(section).getByText("Ningún partido coincide con los filtros")).toBeTruthy();
    fireEvent.click(within(section).getAllByRole("button", { name: "Restablecer filtros" })[0]);
    expect(within(section).getByText("3 partidos")).toBeTruthy();
  });

  it("las regiones salen de los datos cargados", () => {
    render(<HomeDashboard upcoming={matches} recent={[]} upcomingError={null} recentError={null} />);
    const section = screen.getByRole("region", { name: "Próximos partidos" });
    fireEvent.click(within(section).getByRole("button", { name: /región/i }));
    expect(within(section).getByLabelText("ES")).toBeTruthy();
    expect(within(section).getByLabelText("KR")).toBeTruthy();
  });
});
