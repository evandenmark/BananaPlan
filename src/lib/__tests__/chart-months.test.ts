import { describe, it, expect } from "vitest";
import { buildChartMonths, type MonthGroup } from "../chart-months";
import { parseSeriesKey, seriesKey } from "../chart-series";

// Never `new Date("2026-07-30")` — that parses as UTC and lands a day earlier
// in Hawaii (CLAUDE.md standing rule 3).
const JULY_30_2026 = new Date(2026, 6, 30);

const group = (monthKey: string, events: MonthGroup["events"]): MonthGroup => ({
  monthKey,
  events,
});

const actual = (row: Record<string, unknown>, variety: string) =>
  row[seriesKey(variety, "actual")];
const forecast = (row: Record<string, unknown>, variety: string) =>
  row[seriesKey(variety, "forecast")];

describe("seriesKey / parseSeriesKey", () => {
  it("round trips", () => {
    expect(parseSeriesKey(seriesKey("Apple", "actual"))).toEqual({
      variety: "Apple",
      series: "actual",
    });
    expect(parseSeriesKey(seriesKey("Gros Michel", "forecast"))).toEqual({
      variety: "Gros Michel",
      series: "forecast",
    });
  });

  it("splits on the last separator, so a variety containing one survives", () => {
    expect(parseSeriesKey(seriesKey("Odd::Name", "actual"))).toEqual({
      variety: "Odd::Name",
      series: "actual",
    });
  });

  it("rejects anything that is not a series key", () => {
    expect(parseSeriesKey("Apple")).toBeNull();
    expect(parseSeriesKey("monthLabel")).toBeNull();
    expect(parseSeriesKey("Apple::bogus")).toBeNull();
    expect(parseSeriesKey("::actual")).toBeNull();
  });
});

describe("buildChartMonths", () => {
  const base = {
    today: JULY_30_2026,
    varieties: ["Apple"],
    actualsByMonth: {},
    grouped: [] as MonthGroup[],
  };

  it("emits nine months, three behind and six from the current one", () => {
    const rows = buildChartMonths(base);

    expect(rows).toHaveLength(9);
    expect(rows.map((r) => r.monthLabel)).toEqual([
      "Apr 26",
      "May 26",
      "Jun 26",
      "Jul 26",
      "Aug 26",
      "Sep 26",
      "Oct 26",
      "Nov 26",
      "Dec 26",
    ]);
  });

  it("marks only the months wholly in the past as actual", () => {
    const rows = buildChartMonths(base);
    expect(rows.map((r) => r.isActual)).toEqual([
      true, true, true,
      false, false, false, false, false, false,
    ]);
  });

  it("marks exactly one month as current, and it is not an actual month", () => {
    const rows = buildChartMonths(base);
    const current = rows.filter((r) => r.isCurrent);

    expect(current).toHaveLength(1);
    expect(current[0].monthLabel).toBe("Jul 26");
    expect(current[0].isActual).toBe(false);
  });

  // ── The behaviour this module exists for ────────────────────────────────────

  it("draws recorded weight in the CURRENT month", () => {
    const rows = buildChartMonths({
      ...base,
      actualsByMonth: { "2026-07": { Apple: 500 } },
    });

    const july = rows.find((r) => r.monthLabel === "Jul 26")!;
    expect(actual(july, "Apple")).toBe(500);
  });

  it("draws recorded and expected side by side in the current month", () => {
    const rows = buildChartMonths({
      ...base,
      actualsByMonth: { "2026-07": { Apple: 500 } },
      grouped: [group("2026-07", [{ varietyName: "Apple", expectedPounds: 760 }])],
    });

    const july = rows.find((r) => r.monthLabel === "Jul 26")!;
    expect(actual(july, "Apple")).toBe(500);
    expect(forecast(july, "Apple")).toBe(760);
    // Emphatically not summed — ADR 0004.
    expect(actual(july, "Apple")).not.toBe(1260);
  });

  it("keeps past months to recorded weight only", () => {
    const rows = buildChartMonths({
      ...base,
      actualsByMonth: { "2026-06": { Apple: 300 } },
      grouped: [group("2026-06", [{ varietyName: "Apple", expectedPounds: 999 }])],
    });

    const june = rows.find((r) => r.monthLabel === "Jun 26")!;
    expect(actual(june, "Apple")).toBe(300);
    expect(forecast(june, "Apple")).toBe(0);
  });

  it("keeps future months to projection only", () => {
    const rows = buildChartMonths({
      ...base,
      actualsByMonth: { "2026-08": { Apple: 111 } },
      grouped: [group("2026-08", [{ varietyName: "Apple", expectedPounds: 4500 }])],
    });

    const august = rows.find((r) => r.monthLabel === "Aug 26")!;
    expect(actual(august, "Apple")).toBe(0);
    expect(forecast(august, "Apple")).toBe(4500);
  });

  // ── Shape ───────────────────────────────────────────────────────────────────

  it("zero-fills both series for every variety in every month", () => {
    const rows = buildChartMonths({ ...base, varieties: ["Apple", "Namwah"] });

    for (const row of rows) {
      for (const v of ["Apple", "Namwah"]) {
        expect(actual(row, v)).toBe(0);
        expect(forecast(row, v)).toBe(0);
      }
    }
  });

  it("sums multiple forecast events for one variety in a month", () => {
    const rows = buildChartMonths({
      ...base,
      grouped: [
        group("2026-09", [
          { varietyName: "Apple", expectedPounds: 100 },
          { varietyName: "Apple", expectedPounds: 250 },
        ]),
      ],
    });

    expect(forecast(rows.find((r) => r.monthLabel === "Sep 26")!, "Apple")).toBe(350);
  });

  it("rounds pounds to whole numbers", () => {
    const rows = buildChartMonths({
      ...base,
      actualsByMonth: { "2026-07": { Apple: 500.4 } },
      grouped: [group("2026-07", [{ varietyName: "Apple", expectedPounds: 760.6 }])],
    });

    const july = rows.find((r) => r.monthLabel === "Jul 26")!;
    expect(actual(july, "Apple")).toBe(500);
    expect(forecast(july, "Apple")).toBe(761);
  });

  it("ignores varieties that are not in the chart's variety list", () => {
    const rows = buildChartMonths({
      ...base,
      varieties: ["Apple"],
      actualsByMonth: { "2026-07": { Apple: 500, Ghost: 900 } },
      grouped: [group("2026-08", [{ varietyName: "Ghost", expectedPounds: 900 }])],
    });

    const july = rows.find((r) => r.monthLabel === "Jul 26")!;
    expect(actual(july, "Apple")).toBe(500);
    expect(july[seriesKey("Ghost", "actual")]).toBeUndefined();
    expect(rows.find((r) => r.monthLabel === "Aug 26")![seriesKey("Ghost", "forecast")])
      .toBeUndefined();
  });

  it("crosses a year boundary without losing months", () => {
    const rows = buildChartMonths({
      ...base,
      today: new Date(2026, 11, 15), // December 2026
    });

    expect(rows.map((r) => r.monthLabel)).toEqual([
      "Sep 26",
      "Oct 26",
      "Nov 26",
      "Dec 26",
      "Jan 27",
      "Feb 27",
      "Mar 27",
      "Apr 27",
      "May 27",
    ]);
    expect(rows.find((r) => r.isCurrent)!.monthLabel).toBe("Dec 26");
  });

  it("anchors the current month on the date given, not on the clock", () => {
    const rows = buildChartMonths({ ...base, today: new Date(2026, 0, 1) });
    expect(rows.find((r) => r.isCurrent)!.monthLabel).toBe("Jan 26");
  });
});
