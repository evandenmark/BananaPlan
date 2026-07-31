import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForecastChart, type ChartMonth } from "../forecast-chart";
import { seriesKey } from "@/lib/chart-series";

// ── Mock recharts ─────────────────────────────────────────────────────────────
// Recharts uses SVG + ResizeObserver which doesn't work well in jsdom.
// We mock the entire library so tests focus on the component's own logic.

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({
    dataKey,
    stackId,
    fillOpacity,
  }: {
    dataKey: string;
    stackId?: string;
    fillOpacity?: number;
  }) => (
    // stackId is the whole point: recorded and expected must never share a
    // stack, or the current month sums two measurements of the same fruit.
    <div
      data-testid={`bar-${dataKey}`}
      data-stack-id={stackId}
      data-fill-opacity={fillOpacity}
    />
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
  return {
    monthLabel: label,
    isActual: true,
    isCurrent: false,
    [seriesKey(variety, "actual")]: lbs,
  };
}

function makeForecastMonth(label: string, variety = "Namwah", lbs = 200): ChartMonth {
  return {
    monthLabel: label,
    isActual: false,
    isCurrent: false,
    [seriesKey(variety, "forecast")]: lbs,
  };
}

/** The month we are in: recorded so far beside what is still expected. */
function makeCurrentMonth(
  label: string,
  variety = "Namwah",
  recorded = 500,
  expected = 300
): ChartMonth {
  return {
    monthLabel: label,
    isActual: false,
    isCurrent: true,
    [seriesKey(variety, "actual")]: recorded,
    [seriesKey(variety, "forecast")]: expected,
  };
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
      expect(screen.getByTestId(`bar-${seriesKey("Namwah", "forecast")}`)).toBeInTheDocument();
      expect(screen.getByTestId(`bar-${seriesKey("Apple", "forecast")}`)).toBeInTheDocument();
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

    it("renders the subtitle explaining the faded/solid encoding", () => {
      render(<ForecastChart data={nineMonthData} varieties={singleVariety} />);
      expect(
        screen.getByText(/faded.*recorded.*solid.*forecast.*tap a variety/i)
      ).toBeInTheDocument();
    });
  });

  describe("legend", () => {
    it("shows the recorded legend item", () => {
      render(<ForecastChart data={nineMonthData} varieties={singleVariety} />);
      expect(screen.getByText(/recorded \(weight log\)/i)).toBeInTheDocument();
    });

    it("shows the expected legend item", () => {
      render(<ForecastChart data={nineMonthData} varieties={singleVariety} />);
      expect(screen.getByText(/expected \(forecast\)/i)).toBeInTheDocument();
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

      expect(screen.getByTestId(`bar-${seriesKey("Namwah", "forecast")}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`bar-${seriesKey("Apple", "forecast")}`)).not.toBeInTheDocument();
    });

    it("clicking the selected pill again returns to 'All' (shows all bars)", async () => {
      const user = userEvent.setup();
      render(<ForecastChart data={nineMonthData} varieties={twoVarieties} />);

      // Select Namwah
      await user.click(screen.getByRole("button", { name: /namwah/i }));
      expect(screen.queryByTestId(`bar-${seriesKey("Apple", "forecast")}`)).not.toBeInTheDocument();

      // Click again to deselect → back to All
      await user.click(screen.getByRole("button", { name: /namwah/i }));

      expect(screen.getByTestId(`bar-${seriesKey("Namwah", "forecast")}`)).toBeInTheDocument();
      expect(screen.getByTestId(`bar-${seriesKey("Apple", "forecast")}`)).toBeInTheDocument();
    });

    it("clicking 'All' pill when a variety is selected shows all bars", async () => {
      const user = userEvent.setup();
      render(<ForecastChart data={nineMonthData} varieties={twoVarieties} />);

      await user.click(screen.getByRole("button", { name: /namwah/i }));
      await user.click(screen.getByRole("button", { name: "All" }));

      expect(screen.getByTestId(`bar-${seriesKey("Namwah", "forecast")}`)).toBeInTheDocument();
      expect(screen.getByTestId(`bar-${seriesKey("Apple", "forecast")}`)).toBeInTheDocument();
    });

    it("switching between variety pills works correctly", async () => {
      const user = userEvent.setup();
      render(<ForecastChart data={nineMonthData} varieties={twoVarieties} />);

      // Select Apple
      await user.click(screen.getByRole("button", { name: /apple/i }));
      expect(screen.getByTestId(`bar-${seriesKey("Apple", "forecast")}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`bar-${seriesKey("Namwah", "forecast")}`)).not.toBeInTheDocument();

      // Switch to Namwah
      await user.click(screen.getByRole("button", { name: /namwah/i }));
      expect(screen.getByTestId(`bar-${seriesKey("Namwah", "forecast")}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`bar-${seriesKey("Apple", "forecast")}`)).not.toBeInTheDocument();
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
      expect(screen.getByTestId(`bar-${seriesKey("Namwah", "forecast")}`)).toBeInTheDocument();
    });
  });

  describe("multi-variety data", () => {
    it("renders bars for all varieties by default", () => {
      const threeVarieties = ["Namwah", "Apple", "Plantain"];
      const data: ChartMonth[] = [
        {
          monthLabel: "Mar '26",
          isActual: false,
          isCurrent: false,
          [seriesKey("Namwah", "forecast")]: 100,
          [seriesKey("Apple", "forecast")]: 80,
          [seriesKey("Plantain", "forecast")]: 60,
        },
      ];
      render(<ForecastChart data={data} varieties={threeVarieties} />);
      expect(screen.getByTestId(`bar-${seriesKey("Namwah", "forecast")}`)).toBeInTheDocument();
      expect(screen.getByTestId(`bar-${seriesKey("Apple", "forecast")}`)).toBeInTheDocument();
      expect(screen.getByTestId(`bar-${seriesKey("Plantain", "forecast")}`)).toBeInTheDocument();
    });
  });

  describe("current month (recorded beside expected)", () => {
    const withCurrent: ChartMonth[] = [
      ...threeActuals,
      makeCurrentMonth("Feb '26"),
      ...sixForecasts.slice(1),
    ];

    it("renders both a recorded and an expected bar for each variety", () => {
      render(<ForecastChart data={withCurrent} varieties={singleVariety} />);

      expect(
        screen.getByTestId(`bar-${seriesKey("Namwah", "actual")}`)
      ).toBeInTheDocument();
      expect(
        screen.getByTestId(`bar-${seriesKey("Namwah", "forecast")}`)
      ).toBeInTheDocument();
    });

    it("renders two bars per variety when several are shown", () => {
      render(<ForecastChart data={withCurrent} varieties={twoVarieties} />);

      for (const v of twoVarieties) {
        expect(
          screen.getByTestId(`bar-${seriesKey(v, "actual")}`)
        ).toBeInTheDocument();
        expect(
          screen.getByTestId(`bar-${seriesKey(v, "forecast")}`)
        ).toBeInTheDocument();
      }
    });

    it("filtering to one variety hides both of the other's series", async () => {
      const user = userEvent.setup();
      render(<ForecastChart data={withCurrent} varieties={twoVarieties} />);

      await user.click(screen.getByRole("button", { name: /Namwah/ }));

      expect(
        screen.queryByTestId(`bar-${seriesKey("Apple", "actual")}`)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId(`bar-${seriesKey("Apple", "forecast")}`)
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId(`bar-${seriesKey("Namwah", "actual")}`)
      ).toBeInTheDocument();
    });

    it("does not shade the current month as a past month", () => {
      render(<ForecastChart data={withCurrent} varieties={singleVariety} />);
      const refArea = screen.getByTestId("reference-area");
      expect(refArea).toHaveAttribute("data-x2", "Jan '26");
    });

    it("puts recorded and expected in SEPARATE stacks, never summed", () => {
      render(<ForecastChart data={withCurrent} varieties={singleVariety} />);

      const recorded = screen.getByTestId(
        `bar-${seriesKey("Namwah", "actual")}`
      );
      const expectedBar = screen.getByTestId(
        `bar-${seriesKey("Namwah", "forecast")}`
      );

      const a = recorded.getAttribute("data-stack-id");
      const f = expectedBar.getAttribute("data-stack-id");
      expect(a).toBeTruthy();
      expect(f).toBeTruthy();
      // Sharing a stack would draw recorded + expected as one bar — the sum
      // ADR 0004 forbids, since the two can describe the same fruit.
      expect(a).not.toBe(f);
    });

    it("keeps every variety's two series in the same two stacks", () => {
      render(<ForecastChart data={withCurrent} varieties={twoVarieties} />);

      const stackOf = (v: string, s: "actual" | "forecast") =>
        screen.getByTestId(`bar-${seriesKey(v, s)}`).getAttribute("data-stack-id");

      expect(stackOf("Namwah", "actual")).toBe(stackOf("Apple", "actual"));
      expect(stackOf("Namwah", "forecast")).toBe(stackOf("Apple", "forecast"));
      expect(stackOf("Namwah", "actual")).not.toBe(stackOf("Apple", "forecast"));
    });

    it("draws recorded faded so it reads apart from expected", () => {
      render(<ForecastChart data={withCurrent} varieties={singleVariety} />);

      const recorded = screen.getByTestId(
        `bar-${seriesKey("Namwah", "actual")}`
      );
      const expectedBar = screen.getByTestId(
        `bar-${seriesKey("Namwah", "forecast")}`
      );

      // Must be present, not merely absent — `Number(null)` is 0, which would
      // sail past a bare `< 1` check if the prop were dropped entirely.
      const opacity = recorded.getAttribute("data-fill-opacity");
      expect(opacity).not.toBeNull();
      expect(Number(opacity)).toBeGreaterThan(0);
      expect(Number(opacity)).toBeLessThan(1);
      expect(expectedBar.getAttribute("data-fill-opacity")).toBeNull();
    });
  });
});
