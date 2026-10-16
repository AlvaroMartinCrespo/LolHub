// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import type { ReactElement } from "react";
import { finished, makeMatch, team } from "./fixtures";
import type { Team } from "@/types/domain";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));

import { FavoriteTeamButton } from "@/components/favorites/FavoriteTeamButton";
import { FavoritesView } from "@/components/favorites/FavoritesView";
import { DayView } from "@/components/calendar/DayView";
import { DayNavigator } from "@/components/calendar/DayNavigator";
import { CalendarExport } from "@/components/match/CalendarExport";
import { RecordsPanel } from "@/components/stats/RecordsPanel";
import { HeadToHeadPanel } from "@/components/stats/HeadToHeadPanel";
import { computeRecords } from "@/lib/stats/records";
import { computeHeadToHead } from "@/lib/stats/headToHead";
import { STORAGE_KEY } from "@/lib/favorites/store";

async function expectAccessible(ui: ReactElement) {
  const { container } = render(ui);
  const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`)).toEqual([]);
}

beforeEach(() => {
  window.localStorage.clear();
  push.mockClear();
});

describe("favoritos en el navegador", () => {
  it("seguir / dejar de seguir persiste en localStorage", () => {
    render(<FavoriteTeamButton id={5} name="Alpha" />);
    const btn = screen.getByRole("button", { name: /seguir/i });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: /siguiendo/i }).getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).teams).toEqual([{ id: 5, name: "Alpha" }]);
    fireEvent.click(screen.getByRole("button", { name: /siguiendo/i }));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).teams).toEqual([]);
  });

  it("la lista refleja los favoritos guardados y enlaza a próximos y .ics", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ teams: [{ id: 1, name: "Alpha" }, { id: 2, name: "Beta" }] }));
    render(<FavoritesView />);
    expect(screen.getByRole("link", { name: "Alpha" }).getAttribute("href")).toBe("/equipos/1");
    expect(screen.getByRole("link", { name: /próximos partidos/i }).getAttribute("href")).toBe("/favoritos/proximos?ids=1,2");
    expect(screen.getByRole("link", { name: /\.ics/i }).getAttribute("href")).toBe("/favoritos/ics?ids=1,2");
    fireEvent.click(screen.getByRole("button", { name: /quitar a alpha/i }));
    expect(screen.queryByRole("link", { name: "Alpha" })).toBeNull();
  });

  it("estado vacío sin favoritos", () => {
    render(<FavoritesView />);
    expect(screen.getByText("Todavía no sigues a ningún equipo")).toBeTruthy();
  });

  it("datos corruptos en localStorage no rompen la vista", () => {
    window.localStorage.setItem(STORAGE_KEY, "{{{{");
    render(<FavoritesView />);
    expect(screen.getByText("Todavía no sigues a ningún equipo")).toBeTruthy();
  });
});

describe("calendario por día", () => {
  const d = (day: string, hour: number) => new Date(`${day}T00:00:00`.replace("T00", `T${String(hour).padStart(2, "0")}`)).toISOString();
  const ms = [
    makeMatch({ id: 1, startTime: d("2026-10-15", 10) }),
    makeMatch({ id: 2, startTime: d("2026-10-15", 20), league: { id: 2, name: "Liga Dos", slug: null, imageUrl: null } }),
    makeMatch({ id: 3, startTime: d("2026-10-16", 10) }),
  ];

  it("muestra solo los partidos del día local, ordenados", () => {
    render(<DayView matches={ms} day="2026-10-15" />);
    expect(screen.getByText("2 partidos")).toBeTruthy();
  });
  it("filtra por liga dentro del día", () => {
    render(<DayView matches={ms} day="2026-10-15" />);
    fireEvent.click(screen.getByRole("button", { name: /liga/i }));
    fireEvent.click(screen.getByLabelText("Liga Dos"));
    expect(screen.getByText("1 partido")).toBeTruthy();
  });
  it("día sin partidos → estado vacío", () => {
    render(<DayView matches={ms} day="2026-11-01" />);
    expect(screen.getByText("No hay partidos este día")).toBeTruthy();
  });
  it("navegador de días: enlaces anterior/siguiente y día actual marcado", () => {
    render(<DayNavigator day="2026-12-31" />);
    expect(screen.getByRole("link", { name: /anterior/i }).getAttribute("href")).toBe("/calendario?fecha=2026-12-30");
    expect(screen.getByRole("link", { name: /siguiente/i }).getAttribute("href")).toBe("/calendario?fecha=2027-01-01");
    const nav = screen.getByRole("navigation", { name: "Días cercanos" });
    expect(within(nav).getAllByRole("link")).toHaveLength(7);
    expect(nav.querySelector('[aria-current="date"]')!.getAttribute("href")).toBe("/calendario?fecha=2026-12-31");
  });
  it("«Hoy» navega al día local", () => {
    render(<DayNavigator day="2026-12-31" />);
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toMatch(/^\/calendario\?fecha=\d{4}-\d{2}-\d{2}$/);
  });
});

describe("accesibilidad de lo nuevo", () => {
  const a: Team = { id: 1, name: "Alpha", acronym: null, imageUrl: null, region: null, roster: [] };
  const b: Team = { id: 2, name: "Beta", acronym: null, imageUrl: null, region: null, roster: [] };
  const ms = [finished(1, 1, 2, 0), finished(2, 2, 1, 2), finished(3, 1, 2, 1)];

  it("favoritos, calendario, exportación, récords y H2H", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ teams: [{ id: 1, name: "Alpha" }] }));
    await expectAccessible(
      <div>
        <FavoriteTeamButton id={1} name="Alpha" />
        <FavoritesView />
        <DayNavigator day="2026-10-15" />
        <DayView matches={[makeMatch({ id: 1, startTime: new Date("2026-10-15T12:00:00").toISOString() })]} day="2026-10-15" />
        <CalendarExport matchId={9} />
        <RecordsPanel records={computeRecords(ms, 1)} />
        <HeadToHeadPanel a={a} b={b} h2h={computeHeadToHead(ms, 1, 2)} />
      </div>,
    );
  });
  it("H2H muestra el resultado y el aviso de muestra", () => {
    render(<HeadToHeadPanel a={a} b={b} h2h={computeHeadToHead(ms, 1, 2)} />);
    expect(screen.getByText(/2–1/)).toBeTruthy();
    expect(screen.getByText(/últimos 300 partidos/i)).toBeTruthy();
  });
  it("récords muestran las rachas", () => {
    render(<RecordsPanel records={computeRecords(ms, 1)} />);
    expect(screen.getByText("Mayor racha de victorias")).toBeTruthy();
  });
  it("exportación: el formulario apunta a la ruta .ics con GET", () => {
    const { container } = render(<CalendarExport matchId={9} />);
    const form = container.querySelector("form")!;
    expect(form.getAttribute("action")).toBe("/partidos/9/ics");
    expect(form.getAttribute("method")).toBe("get");
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("15");
  });
});
