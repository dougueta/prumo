import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TodayProvider, useToday } from "@/components/shell/today-provider";

/** FR-029 / research R-08 — "hoje" vem do servidor e é recalculado ao voltar à aba. */
function Show() {
  return <span data-testid="today">{useToday()}</span>;
}

function fireVisible() {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("TodayProvider", () => {
  it("usa o valor inicial do servidor, sem divergência na hidratação", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T15:00:00Z"));
    const html = renderToString(
      <TodayProvider today="2026-09-30">
        <Show />
      </TodayProvider>,
    );
    expect(html).toContain("2026-09-30");
    render(
      <TodayProvider today="2026-09-30">
        <Show />
      </TodayProvider>,
    );
    expect(screen.getByTestId("today")).toHaveTextContent("2026-09-30");
  });

  it("recalcula no fuso de São Paulo quando a aba volta a ficar visível", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T02:00:00Z")); // 23:00 de 30/09 em SP
    render(
      <TodayProvider today="2026-09-30">
        <Show />
      </TodayProvider>,
    );
    vi.setSystemTime(new Date("2026-10-01T04:00:00Z")); // 01:00 de 01/10 em SP
    act(() => fireVisible());
    expect(screen.getByTestId("today")).toHaveTextContent("2026-10-01");
  });

  it("com fixed não recalcula (catálogo)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-25T12:00:00Z"));
    render(
      <TodayProvider today="2026-09-30" fixed>
        <Show />
      </TodayProvider>,
    );
    act(() => fireVisible());
    expect(screen.getByTestId("today")).toHaveTextContent("2026-09-30");
  });

  it("um provider interno sobrepõe o externo", () => {
    render(
      <TodayProvider today="2026-10-08">
        <TodayProvider today="2026-09-30" fixed>
          <Show />
        </TodayProvider>
      </TodayProvider>,
    );
    expect(screen.getByTestId("today")).toHaveTextContent("2026-09-30");
  });
});
