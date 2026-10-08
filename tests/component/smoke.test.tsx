import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

it("ambiente jsdom com jest-dom", () => {
  render(<p>Prumo</p>);
  expect(screen.getByText("Prumo")).toBeInTheDocument();
  expect(window.matchMedia("(min-width: 768px)").matches).toBe(false);
});
