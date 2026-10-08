import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PeriodLabel } from "@/components/finance/period-label";
import { RelativeDate } from "@/components/finance/relative-date";
import { TodayProvider } from "@/components/shell/today-provider";

/** contracts/components.md §2 — FR-029, FR-030. "Hoje" vem do TodayProvider. */
function withToday(node: React.ReactNode) {
  return render(
    <TodayProvider today="2026-09-30" fixed>
      {node}
    </TodayProvider>,
  );
}

describe("RelativeDate", () => {
  it.each([
    ["2026-09-30", "Hoje"],
    ["2026-09-29", "Ontem"],
    ["2026-10-01", "Amanhã"],
    ["2026-09-28", "28 set."],
    ["2025-09-28", "28 set. 2025"],
  ])("%s → %s", (date, text) => {
    const { container } = withToday(<RelativeDate date={date} />);
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", date);
    expect(time?.querySelector("[aria-hidden=true]")).toHaveTextContent(text);
  });

  it("data completa sempre disponível ao leitor de tela e no título", () => {
    const { container } = withToday(<RelativeDate date="2026-09-29" />);
    expect(screen.getByText("29 de setembro de 2026")).toHaveClass("sr-only");
    expect(container.querySelector("time")).toHaveAttribute("title", "29/09/2026");
  });

  it("variante absoluta", () => {
    const { container } = withToday(<RelativeDate date="2026-09-28" variant="absolute" />);
    expect(container.querySelector("time [aria-hidden=true]")).toHaveTextContent("28/09/2026");
  });
});

describe("PeriodLabel", () => {
  it("mês por extenso", () => {
    render(<PeriodLabel month="2026-09" />);
    expect(screen.getByText("Setembro de 2026")).toBeInTheDocument();
  });

  it("intervalo no mesmo mês e entre meses", () => {
    render(
      <>
        <PeriodLabel from="2026-09-01" to="2026-09-15" />
        <PeriodLabel from="2026-09-28" to="2026-10-03" />
      </>,
    );
    expect(screen.getByText("1–15 set.")).toBeInTheDocument();
    expect(screen.getByText("28 set. – 3 out.")).toBeInTheDocument();
  });
});
