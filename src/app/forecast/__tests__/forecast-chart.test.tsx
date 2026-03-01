import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForecastChart, type ChartMonth } from "../forecast-chart";

// ── Mock recharts ─────────────────────────────────────────────────────────────
// Recharts uses SVG + ResizeObserver which doesn't work well in jsdom.
// We mock the entire library so tests focus on the component's own logic.

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => (
    <div data-testid={`bar-${dataKey}`} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ReferenceArea: ({ x1, x2 }: { x1: string; x2: string }) => (
    <div data-testid="reference-area" data-x1={x1} data-x2={x2} />
  ),
  ReferenceLine: ({ x }: { x: string }) => (
    <div data-testid="reference-line" data-x={x} />
  ),
}));

// ── Test data factories ───────────────────────────────────────────────────────

function makeActualMonth(label: string, variety = "Namwah", lbs = 100): ChartMonth {
  return { monthLabel: label, isActual: true, [variety]: lbs };
}

function makeForecastMonth(label: string, variety = "Namwah", lbs = 200): ChartMonth {
  return { monthLabel: label, isActual: false, [variety]: lbs };
}

const singleVariety = ["Namwah"];
const twoVarieties = ["Namwah", "Apple"];

const threeActuals: ChartMonth[] = [
  makeActualMonth("Nov '25"),
  makeActualMonth("Dec '25"),
  makeActualMonth("Jan '26"),
];

const sixForecasts: ChartMonth[] = [
  makeForecastMonth("Feb '26"),
  makeForecastMonth("Mar '26"),
  makeForecastMonth("Apr '26"),
  makeForecastMonth("May '26"),
  makeForecastMonth("Jun '26"),
  makeForecastMonth("Jul '26"),
];

const nineMonthData: ChartMonth[] = [...threeActuals, ...sixForecasts];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ForecastChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("empty data", () => {
    it("renders nothing when data is empty", () => {
      const { container } = render(<ForecastChart data={[]} varieties={[]} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("chart structure", () => {
    it("renders the chart container and recharts components", () => {
      render(<ForecastChart data={nineMonthData} varieties={singleVariety} />);
      expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });

    it("renders one Bar per visible variety", () => {
      render(<ForecastChart data={nineMonthData} varieties={twoVarieties} />);
      expect(screen.getByTestId("bar-Namwah")).toBeInTheDocument();
      expect(screen.getByTestId("bar-Apple")).toBeInTheDocument();
    });

    it("renders a ReferenceArea for actual (past) months", () => {
      render(<ForecastChart data={nineMonthData} varieties={singleVariety} />);
      const refArea = screen.getByTestId("reference-area");
      expect(refArea).toBeInTheDocument();
      expect(refArea).toHaveAttribute("data-x1", "Nov '25");
      expect(refArea).toHaveAttribute("data-x2", "Jan '26");
    });

    it("renders a ReferenceLine at the first forecast month", () => {
      render(<ForecastChart data={nineMonthData} varieties={singleVariety} />);
      const refLine = screen.getByTestId("reference-line");
      expect(refLine).toHaveAttribute("data-x", "Feb '26");
    });

    it("does not render ReferenceArea when there are no actual months", () => {
      render(<ForecastChart data={sixForecasts} varieties={singleVariety} />);
      expect(screen.queryByTestId("reference-area")).not.toBeInTheDocument();
    });

    it("does not render ReferenceLine when all data is actual (no forecast)", () => {
      render(<ForecastChart data={threeActuals} varieties={singleVariety} />);
      expect(screen.queryByTestId("reference-line")).not.toBeInTheDocument();
    });
  });

  describe("title and subtitle", () => {
    it("renders the 9-Month Overview heading", () => {
      render(<ForecastChart data={nineMonthData} varieties={singleVariety} />);
      expect(screen.getByText("9-Month Overview")).toBeInTheDocument();
    });

    it("renders the subtitle about shading and filtering", () => {
      render(<ForecastChart data={nineMonthData} varieties={singleVariety} />);
      expect(
        screen.getByText(/shaded.*recorded weight.*tap a variety/i)
      ).toBeInTheDocument();
    });
  });

  describe("legend", () => {
    it("shows 'Actual (weight log)' legend item", () => {
      render(<ForecastChart data={nineMonthData} varieties={singleVariety} />);
      expect(screen.getByText(/actual \(weight log\)/i)).toBeInTheDocument();
    });

    it("shows 'Forecast' legend item", () => {
      render(<ForecastChart data={nineMonthData} varieties={singleVariety} />);
      expect(screen.getByText("Forecast")).toBeInTheDocument();
    });
  });

  describe("variety filter pills", () => {
    it("renders an 'All' pill that is selected by default", () => {
      render(<ForecastChart data={nineMonthData} varieties={twoVarieties} />);
      const allBtn = screen.getByRole("button", { name: "All" });
      expect(allBtn).toBeInTheDocument();
      // The All button has dark selected styling (bg-gray-900)
      expect(allBtn.className).toMatch(/bg-gray-900/);
    });

    it("renders a pill for each variety", () => {
      render(<ForecastChart data={nineMonthData} varieties={twoVarieties} />);
      expect(screen.getByRole("button", { name: /namwah/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /apple/i })).toBeInTheDocument();
    });

    it("selecting a variety pill renders only that variety's bar", async () => {
      const user = userEvent.setup();
      render(<ForecastChart data={nineMonthData} varieties={twoVarieties} />);

      await user.click(screen.getByRole("button", { name: /namwah/i }));

      expect(screen.getByTestId("bar-Namwah")).toBeInTheDocument();
      expect(screen.queryByTestId("bar-Apple")).not.toBeInTheDocument();
    });

    it("clicking the selected pill again returns to 'All' (shows all bars)", async () => {
      const user = userEvent.setup();
      render(<ForecastChart data={nineMonthData} varieties={twoVarieties} />);

      // Select Namwah
      await user.click(screen.getByRole("button", { name: /namwah/i }));
      expect(screen.queryByTestId("bar-Apple")).not.toBeInTheDocument();

      // Click again to deselect → back to All
      await user.click(screen.getByRole("button", { name: /namwah/i }));

      expect(screen.getByTestId("bar-Namwah")).toBeInTheDocument();
      expect(screen.getByTestId("bar-Apple")).toBeInTheDocument();
    });

    it("clicking 'All' pill when a variety is selected shows all bars", async () => {
      const user = userEvent.setup();
      render(<ForecastChart data={nineMonthData} varieties={twoVarieties} />);

      await user.click(screen.getByRole("button", { name: /namwah/i }));
      await user.click(screen.getByRole("button", { name: "All" }));

      expect(screen.getByTestId("bar-Namwah")).toBeInTheDocument();
      expect(screen.getByTestId("bar-Apple")).toBeInTheDocument();
    });

    it("switching between variety pills works correctly", async () => {
      const user = userEvent.setup();
      render(<ForecastChart data={nineMonthData} varieties={twoVarieties} />);

      // Select Apple
      await user.click(screen.getByRole("button", { name: /apple/i }));
      expect(screen.getByTestId("bar-Apple")).toBeInTheDocument();
      expect(screen.queryByTestId("bar-Namwah")).not.toBeInTheDocument();

      // Switch to Namwah
      await user.click(screen.getByRole("button", { name: /namwah/i }));
      expect(screen.getByTestId("bar-Namwah")).toBeInTheDocument();
      expect(screen.queryByTestId("bar-Apple")).not.toBeInTheDocument();
    });

    it("renders only one pill when there is one variety", () => {
      render(<ForecastChart data={nineMonthData} varieties={singleVariety} />);
      // All + Namwah = 2 filter pills
      const pills = screen.getAllByRole("button").filter(
        (b) => b.className.includes("rounded-full")
      );
      expect(pills).toHaveLength(2);
    });
  });

  describe("data-only forecast (no actuals)", () => {
    it("renders bars for forecast-only data without errors", () => {
      render(<ForecastChart data={sixForecasts} varieties={singleVariety} />);
      expect(screen.getByTestId("bar-Namwah")).toBeInTheDocument();
    });
  });

  describe("multi-variety data", () => {
    it("renders bars for all varieties by default", () => {
      const threeVarieties = ["Namwah", "Apple", "Plantain"];
      const data: ChartMonth[] = [
        { monthLabel: "Mar '26", isActual: false, Namwah: 100, Apple: 80, Plantain: 60 },
      ];
      render(<ForecastChart data={data} varieties={threeVarieties} />);
      expect(screen.getByTestId("bar-Namwah")).toBeInTheDocument();
      expect(screen.getByTestId("bar-Apple")).toBeInTheDocument();
      expect(screen.getByTestId("bar-Plantain")).toBeInTheDocument();
    });
  });
});
