import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from "vitest";
import {
  computeForecast,
  farmDateString,
  farmToday,
  groupForecastByMonth,
  type InventoryRow,
  type HarvestRecord,
  type ForecastEvent,
} from "../forecast";

// Fix "today" to a known date so tests are deterministic
const FAKE_TODAY = new Date("2026-03-01T00:00:00.000Z");

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FAKE_TODAY);
});

afterAll(() => {
  vi.useRealTimers();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<InventoryRow> = {}): InventoryRow {
  return {
    id: 1,
    fieldId: 1,
    fieldName: "K1",
    siteName: "Kemo'o",
    varietyId: 1,
    varietyName: "Namwah",
    numberOfMats: 10,
    // Planted 9 months before today → first bunch exactly at today
    plantingDate: "2025-06-01",
    monthsToFirstBunch: "9",
    monthsToSubsequentBunch: "3",
    totalBunchesPerMat: 3,
    poundsPerBunch: "25",
    successRate: "0.9",
    ...overrides,
  };
}

function makeHarvest(overrides: Partial<HarvestRecord> = {}): HarvestRecord {
  return {
    fieldId: 1,
    varietyId: 1,
    bunches: 0,
    harvestDate: "2026-01-01",
    ...overrides,
  };
}

// ── computeForecast ───────────────────────────────────────────────────────────

describe("computeForecast", () => {
  describe("empty / trivial cases", () => {
    it("returns [] for empty inventory", () => {
      expect(computeForecast([], [])).toEqual([]);
    });

    it("returns [] when all events are in the past", () => {
      // Planted 24 months ago, first bunch 9 months ago, only 1 bunch per mat
      const row = makeRow({
        plantingDate: "2024-03-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
      });
      const result = computeForecast([row], []);
      expect(result).toHaveLength(0);
    });

    it("returns [] when surviving mats is 0 (successRate = 0)", () => {
      const row = makeRow({ successRate: "0" });
      expect(computeForecast([row], [])).toEqual([]);
    });

    it("returns [] when numberOfMats * successRate floors to 0", () => {
      // 1 mat × 0.4 = 0.4, floor = 0
      const row = makeRow({ numberOfMats: 1, successRate: "0.4" });
      expect(computeForecast([row], [])).toEqual([]);
    });
  });

  describe("surviving mats calculation", () => {
    it("floors numberOfMats × successRate", () => {
      // 10 mats × 0.9 = 9.0 → 9 surviving mats
      const row = makeRow({ numberOfMats: 10, successRate: "0.9", totalBunchesPerMat: 1 });
      // Plant 3 months ago, first bunch in 9 months from plant = 6 months from now (future)
      const planted = new Date(FAKE_TODAY);
      planted.setMonth(planted.getMonth() - 3);
      const plantingDate = planted.toISOString().split("T")[0];
      const result = computeForecast([{ ...row, plantingDate }], []);
      expect(result[0]?.expectedBunches).toBe(9);
    });

    it("uses Math.floor, not Math.round (7 × 0.9 = 6.3 → 6)", () => {
      const planted = new Date(FAKE_TODAY);
      planted.setMonth(planted.getMonth() - 3);
      const plantingDate = planted.toISOString().split("T")[0];
      const row = makeRow({ numberOfMats: 7, successRate: "0.9", totalBunchesPerMat: 1, plantingDate });
      const result = computeForecast([row], []);
      expect(result[0]?.expectedBunches).toBe(6); // floor(6.3) = 6
    });
  });

  describe("future event generation", () => {
    it("includes today's event (expectedDate >= today)", () => {
      // First bunch lands exactly on today: planted 9 months ago to the day
      const planted = new Date(FAKE_TODAY);
      planted.setMonth(planted.getMonth() - 9);
      const plantingDate = planted.toISOString().split("T")[0];
      const row = makeRow({ plantingDate, monthsToFirstBunch: "9", totalBunchesPerMat: 1 });
      const result = computeForecast([row], []);
      expect(result.length).toBeGreaterThan(0);
    });

    it("generates correct number of events for totalBunchesPerMat", () => {
      // All future events: planting date is recent, many months to first bunch
      const row = makeRow({
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 4,
      });
      const result = computeForecast([row], []);
      expect(result).toHaveLength(4);
    });

    it("calculates expectedPounds = bunches × poundsPerBunch", () => {
      const row = makeRow({
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
        numberOfMats: 10,
        successRate: "1.0",
        poundsPerBunch: "30",
      });
      const result = computeForecast([row], []);
      expect(result[0].expectedBunches).toBe(10);
      expect(result[0].expectedPounds).toBe(300);
    });

    it("returns results sorted chronologically by expectedDate", () => {
      // Two inventory rows with different expected dates
      const rowA = makeRow({
        id: 1,
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "12",
        totalBunchesPerMat: 1,
      });
      const rowB = makeRow({
        id: 2,
        varietyId: 2,
        varietyName: "Apple",
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
      });
      const result = computeForecast([rowA, rowB], []);
      // rowB (9-month first bunch) should come before rowA (12-month first bunch)
      expect(result[0].varietyName).toBe("Apple");
      expect(result[1].varietyName).toBe("Namwah");
    });

    it("populates all ForecastEvent fields correctly", () => {
      const row = makeRow({
        id: 7,
        fieldId: 3,
        fieldName: "K3",
        siteName: "Big Tree",
        varietyId: 5,
        varietyName: "Apple",
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
        numberOfMats: 5,
        successRate: "1.0",
        poundsPerBunch: "20",
      });
      const result = computeForecast([row], []);
      expect(result[0]).toMatchObject({
        inventoryId: 7,
        fieldId: 3,
        fieldName: "K3",
        siteName: "Big Tree",
        varietyId: 5,
        varietyName: "Apple",
        expectedBunches: 5,
        expectedPounds: 100,
        bunchIndex: 0,
      });
      expect(result[0].expectedDate).toBeInstanceOf(Date);
    });
  });

  describe("harvest deduction", () => {
    // Use a row with 3 future events of 9 surviving mats each
    const futurePlantingDate = "2026-01-01";

    it("subtracts harvested bunches from earliest event first", () => {
      const row = makeRow({
        plantingDate: futurePlantingDate,
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 3,
        numberOfMats: 10,
        successRate: "0.9", // 9 surviving mats → 9 per event
        poundsPerBunch: "25",
      });
      // Harvest 4 bunches: should reduce first event from 9 to 5
      const harvest = makeHarvest({ fieldId: 1, varietyId: 1, bunches: 4 });
      const result = computeForecast([row], [harvest]);
      expect(result[0].bunchIndex).toBe(0);
      expect(result[0].expectedBunches).toBe(5);
      expect(result[1].expectedBunches).toBe(9); // second event unchanged
      expect(result[2].expectedBunches).toBe(9); // third event unchanged
    });

    it("eliminates an event when harvest equals that event's bunches", () => {
      const row = makeRow({
        plantingDate: futurePlantingDate,
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 3,
        numberOfMats: 9,
        successRate: "1.0", // exactly 9 mats
        poundsPerBunch: "25",
      });
      // Harvest exactly 9 = eliminates the first event
      const harvest = makeHarvest({ bunches: 9 });
      const result = computeForecast([row], [harvest]);
      expect(result).toHaveLength(2);
      expect(result[0].bunchIndex).toBe(1); // first remaining is bunchIndex 1
    });

    it("carries overflow deduction to subsequent events", () => {
      const row = makeRow({
        plantingDate: futurePlantingDate,
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 3,
        numberOfMats: 10,
        successRate: "1.0", // 10 mats per event
        poundsPerBunch: "25",
      });
      // Harvest 15: eliminates first event (10) and removes 5 from second (10 - 5 = 5)
      const harvest = makeHarvest({ bunches: 15 });
      const result = computeForecast([row], [harvest]);
      expect(result).toHaveLength(2);
      expect(result[0].bunchIndex).toBe(1);
      expect(result[0].expectedBunches).toBe(5);
      expect(result[1].bunchIndex).toBe(2);
      expect(result[1].expectedBunches).toBe(10);
    });

    it("returns empty when harvest exceeds all events", () => {
      const row = makeRow({
        plantingDate: futurePlantingDate,
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 2,
        numberOfMats: 5,
        successRate: "1.0", // 5 per event, 2 events = 10 total
        poundsPerBunch: "25",
      });
      // Harvest more than all bunches
      const harvest = makeHarvest({ bunches: 999 });
      const result = computeForecast([row], [harvest]);
      expect(result).toHaveLength(0);
    });

    it("accumulates multiple harvest records for the same field/variety key", () => {
      const row = makeRow({
        plantingDate: futurePlantingDate,
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 3,
        numberOfMats: 10,
        successRate: "1.0", // 10 per event
        poundsPerBunch: "25",
      });
      // Two separate harvests totaling 15
      const h1 = makeHarvest({ bunches: 8 });
      const h2 = makeHarvest({ bunches: 7 });
      const result = computeForecast([row], [h1, h2]);
      // Total deducted: 15 → first event (10) eliminated, second reduced by 5 → 5
      expect(result).toHaveLength(2);
      expect(result[0].expectedBunches).toBe(5);
    });
  });

  describe("deduction key isolation", () => {
    it("harvests from a different field do not affect a row's deduction pool", () => {
      const row = makeRow({
        fieldId: 1,
        varietyId: 1,
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
        numberOfMats: 10,
        successRate: "1.0",
      });
      // Harvest is for fieldId: 2, not 1 → should not affect row
      const harvest = makeHarvest({ fieldId: 2, varietyId: 1, bunches: 10 });
      const result = computeForecast([row], [harvest]);
      expect(result).toHaveLength(1);
      expect(result[0].expectedBunches).toBe(10);
    });

    it("harvests for a different variety do not affect the row", () => {
      const row = makeRow({
        fieldId: 1,
        varietyId: 1,
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
        numberOfMats: 10,
        successRate: "1.0",
      });
      const harvest = makeHarvest({ fieldId: 1, varietyId: 99, bunches: 10 });
      const result = computeForecast([row], [harvest]);
      expect(result).toHaveLength(1);
      expect(result[0].expectedBunches).toBe(10);
    });

    it("two rows with same variety in different fields have separate deduction pools", () => {
      const rowField1 = makeRow({
        id: 1,
        fieldId: 1,
        varietyId: 1,
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
        numberOfMats: 10,
        successRate: "1.0",
      });
      const rowField2 = makeRow({
        id: 2,
        fieldId: 2,
        varietyId: 1,
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
        numberOfMats: 10,
        successRate: "1.0",
      });
      // Harvest only applies to field 1
      const harvest = makeHarvest({ fieldId: 1, varietyId: 1, bunches: 10 });
      const result = computeForecast([rowField1, rowField2], [harvest]);
      // Field 1 fully deducted, field 2 untouched
      expect(result).toHaveLength(1);
      expect(result[0].fieldId).toBe(2);
      expect(result[0].expectedBunches).toBe(10);
    });

    it("two varieties in same field have separate deduction pools", () => {
      const rowV1 = makeRow({
        id: 1,
        fieldId: 1,
        varietyId: 1,
        varietyName: "Namwah",
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
        numberOfMats: 10,
        successRate: "1.0",
      });
      const rowV2 = makeRow({
        id: 2,
        fieldId: 1,
        varietyId: 2,
        varietyName: "Apple",
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
        numberOfMats: 10,
        successRate: "1.0",
      });
      // Harvest only for variety 1
      const harvest = makeHarvest({ fieldId: 1, varietyId: 1, bunches: 10 });
      const result = computeForecast([rowV1, rowV2], [harvest]);
      expect(result).toHaveLength(1);
      expect(result[0].varietyId).toBe(2);
    });
  });

  describe("multiple inventory rows", () => {
    it("aggregates results from multiple distinct inventory rows", () => {
      const rowA = makeRow({
        id: 1,
        fieldId: 1,
        varietyId: 1,
        varietyName: "Namwah",
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
      });
      const rowB = makeRow({
        id: 2,
        fieldId: 2,
        varietyId: 2,
        varietyName: "Apple",
        plantingDate: "2026-01-01",
        monthsToFirstBunch: "9",
        totalBunchesPerMat: 1,
      });
      const result = computeForecast([rowA, rowB], []);
      expect(result).toHaveLength(2);
    });
  });
});

// ── groupForecastByMonth ──────────────────────────────────────────────────────
// NOTE: Use new Date(year, month, day) (0-indexed month) for all dates to
// ensure LOCAL time is used. ISO strings like "2026-06-01" parse as UTC
// midnight, which shifts to the previous month in UTC-offset timezones.

// ── Month-end ceiling (ADR 0014) ──────────────────────────────────────────────

describe("month-end ceiling", () => {
  // Local time deliberately, not UTC: the suite's own FAKE_TODAY is
  // 2026-03-01T00:00:00Z, which is Feb 28 in Hawaii. These tests need "today"
  // to sit unambiguously mid-month.
  const MID_MARCH = new Date(2026, 2, 15);
  // Anchored to a real instant rather than a host-local one: 10:00 UTC is
  // exactly midnight in Hawaii, so this is April 1 on the farm whatever
  // timezone the test host is in.
  const APRIL_1_ON_THE_FARM = new Date(Date.UTC(2026, 3, 1, 10, 1, 0));

  afterEach(() => {
    vi.setSystemTime(FAKE_TODAY);
  });

  // Planted 2025-06-01 + 9 months → first bunch computes to 2026-03-01,
  // two weeks before "today".
  const rowFruitingEarlierThisMonth = () =>
    makeRow({
      plantingDate: "2025-06-01",
      monthsToFirstBunch: "9",
      totalBunchesPerMat: 1,
    });

  it("keeps an event whose exact day has passed but whose month has not", () => {
    vi.setSystemTime(MID_MARCH);

    const result = computeForecast([rowFruitingEarlierThisMonth()], []);

    expect(result).toHaveLength(1);
    expect(result[0].expectedBunches).toBe(9); // floor(10 × 0.9)
  });

  it("reports that event on the last day of its month", () => {
    vi.setSystemTime(MID_MARCH);

    const [event] = computeForecast([rowFruitingEarlierThisMonth()], []);

    expect(event.expectedDate.getFullYear()).toBe(2026);
    expect(event.expectedDate.getMonth()).toBe(2); // March
    expect(event.expectedDate.getDate()).toBe(31);
  });

  it("drops the event once its month is over", () => {
    vi.setSystemTime(APRIL_1_ON_THE_FARM);

    expect(computeForecast([rowFruitingEarlierThisMonth()], [])).toHaveLength(0);
  });

  it("lets a harvest recorded later in the month deduct from that month", () => {
    vi.setSystemTime(MID_MARCH);

    const withHarvest = computeForecast(
      [rowFruitingEarlierThisMonth()],
      [makeHarvest({ bunches: 5, harvestDate: "2026-03-14" })]
    );

    // 9 surviving mats less 5 recorded. Before the ceiling this deduction
    // landed on an event that was then discarded, so recording was a no-op.
    expect(withHarvest).toHaveLength(1);
    expect(withHarvest[0].expectedBunches).toBe(4);
  });

  it("ceilings future events too, without moving them to another month", () => {
    vi.setSystemTime(MID_MARCH);

    // First bunch 2026-03-01, then every 3 months: June, September.
    const result = computeForecast(
      [makeRow({ plantingDate: "2025-06-01", monthsToFirstBunch: "9" })],
      []
    );

    expect(result.map((e) => e.expectedDate.getMonth())).toEqual([2, 5, 8]);
    expect(result.map((e) => e.expectedDate.getDate())).toEqual([31, 30, 30]);
  });

  it("groups ceilinged events into the month they belong to", () => {
    vi.setSystemTime(MID_MARCH);

    const groups = groupForecastByMonth(
      computeForecast([rowFruitingEarlierThisMonth()], [])
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].monthKey).toBe("2026-03");
  });
});


// ── Farm timezone (ADR 0014) ──────────────────────────────────────────────────

describe("farmDateString", () => {
  // These assert on a formatted string, so they hold whatever timezone the
  // machine running them is in — which is the point: the bug they pin only
  // appears on a UTC server.
  it("reports the farm's calendar date, not the server's", () => {
    // 2026-08-01 02:00 UTC is still 4pm on July 31 in Hawaii.
    const instant = new Date(Date.UTC(2026, 7, 1, 2, 0, 0));
    expect(farmDateString(instant)).toBe("2026-07-31");
  });

  it("agrees with the server when they are in the same day", () => {
    // 2026-07-15 20:00 UTC is 10am July 15 in Hawaii.
    expect(farmDateString(new Date(Date.UTC(2026, 6, 15, 20, 0, 0)))).toBe(
      "2026-07-15"
    );
  });

  it("rolls over at Hawaii midnight, not UTC midnight", () => {
    // 10:00 UTC on Aug 1 is exactly midnight Aug 1 in Hawaii.
    expect(farmDateString(new Date(Date.UTC(2026, 7, 1, 9, 59, 0)))).toBe(
      "2026-07-31"
    );
    expect(farmDateString(new Date(Date.UTC(2026, 7, 1, 10, 0, 0)))).toBe(
      "2026-08-01"
    );
  });
});

describe("farmToday", () => {
  it("returns the farm's date at midnight", () => {
    const d = farmToday(new Date(Date.UTC(2026, 7, 1, 2, 0, 0)));

    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July
    expect(d.getDate()).toBe(31);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe("month expiry boundary", () => {
  afterEach(() => {
    vi.setSystemTime(FAKE_TODAY);
  });

  const rowFruitingInMarch = () =>
    makeRow({
      plantingDate: "2025-06-01",
      monthsToFirstBunch: "9",
      totalBunchesPerMat: 1,
    });

  it("keeps the month's event on the last day, in the afternoon", () => {
    // Late on the final day: the event sits at midnight that same day, so a
    // comparison against a clock carrying a time of day would drop it.
    vi.setSystemTime(new Date(2026, 2, 31, 16, 30));

    expect(computeForecast([rowFruitingInMarch()], [])).toHaveLength(1);
  });

  it("still deducts a harvest recorded on the last day of the month", () => {
    vi.setSystemTime(new Date(2026, 2, 31, 16, 30));

    const result = computeForecast(
      [rowFruitingInMarch()],
      [makeHarvest({ bunches: 5, harvestDate: "2026-03-31" })]
    );

    expect(result).toHaveLength(1);
    expect(result[0].expectedBunches).toBe(4); // 9 surviving less 5 recorded
  });

  it("keeps the event after UTC rolls over but before the farm's month ends", () => {
    // 2026-04-01 02:00 UTC is 4pm on March 31 in Hawaii. A server reading its
    // own clock calls this April and discards March; the farm has not finished
    // picking. This is the case that only fails on a UTC host.
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 1, 2, 0, 0)));

    expect(computeForecast([rowFruitingInMarch()], [])).toHaveLength(1);
  });

  it("drops it once the farm's next month begins", () => {
    // 10:00 UTC on April 1 is exactly midnight April 1 in Hawaii.
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 1, 10, 1, 0)));

    expect(computeForecast([rowFruitingInMarch()], [])).toHaveLength(0);
  });
});


describe("groupForecastByMonth", () => {
  function makeEvent(overrides: Partial<ForecastEvent> = {}): ForecastEvent {
    return {
      inventoryId: 1,
      fieldId: 1,
      fieldName: "K1",
      siteName: "Kemo'o",
      varietyId: 1,
      varietyName: "Namwah",
      expectedDate: new Date(2026, 5, 15), // June 15 local time
      expectedBunches: 10,
      expectedPounds: 250,
      bunchIndex: 0,
      ...overrides,
    };
  }

  it("returns [] for empty input", () => {
    expect(groupForecastByMonth([])).toEqual([]);
  });

  it("returns a single group for a single event", () => {
    const event = makeEvent({ expectedDate: new Date(2026, 5, 15) }); // June 15
    const result = groupForecastByMonth([event]);
    expect(result).toHaveLength(1);
    expect(result[0].monthKey).toBe("2026-06");
    expect(result[0].events).toEqual([event]);
  });

  it("merges two events in the same month into one group", () => {
    const e1 = makeEvent({ expectedDate: new Date(2026, 5, 1), expectedBunches: 5, expectedPounds: 125 });
    const e2 = makeEvent({ expectedDate: new Date(2026, 5, 20), expectedBunches: 8, expectedPounds: 200 });
    const result = groupForecastByMonth([e1, e2]);
    expect(result).toHaveLength(1);
    expect(result[0].totalBunches).toBe(13);
    expect(result[0].totalPounds).toBe(325);
    expect(result[0].events).toHaveLength(2);
  });

  it("creates separate groups for events in different months", () => {
    const e1 = makeEvent({ expectedDate: new Date(2026, 4, 1) }); // May
    const e2 = makeEvent({ expectedDate: new Date(2026, 7, 1) }); // August
    const result = groupForecastByMonth([e1, e2]);
    expect(result).toHaveLength(2);
    expect(result[0].monthKey).toBe("2026-05");
    expect(result[1].monthKey).toBe("2026-08");
  });

  it("sorts groups chronologically (ascending monthKey)", () => {
    const eLate = makeEvent({ expectedDate: new Date(2026, 11, 1) }); // December
    const eEarly = makeEvent({ expectedDate: new Date(2026, 3, 1) }); // April
    const result = groupForecastByMonth([eLate, eEarly]);
    expect(result[0].monthKey).toBe("2026-04");
    expect(result[1].monthKey).toBe("2026-12");
  });

  it("correctly pads single-digit months with leading zero", () => {
    const event = makeEvent({ expectedDate: new Date(2026, 3, 10) }); // April 10
    const result = groupForecastByMonth([event]);
    expect(result[0].monthKey).toBe("2026-04");
  });

  it("sums bunches and pounds across all events in a month", () => {
    const events = [
      makeEvent({ expectedDate: new Date(2026, 6, 1), expectedBunches: 10, expectedPounds: 250 }),  // July 1
      makeEvent({ expectedDate: new Date(2026, 6, 5), expectedBunches: 6, expectedPounds: 120 }),   // July 5
      makeEvent({ expectedDate: new Date(2026, 6, 20), expectedBunches: 4, expectedPounds: 80 }),   // July 20
    ];
    const result = groupForecastByMonth(events);
    expect(result[0].totalBunches).toBe(20);
    expect(result[0].totalPounds).toBe(450);
  });

  it("includes all events in the group's events array", () => {
    const events = [
      makeEvent({ expectedDate: new Date(2026, 8, 1), varietyName: "Namwah" }),  // Sep 1
      makeEvent({ expectedDate: new Date(2026, 8, 15), varietyName: "Apple" }),  // Sep 15
    ];
    const result = groupForecastByMonth(events);
    expect(result[0].events).toHaveLength(2);
    expect(result[0].events.map((e) => e.varietyName)).toEqual(["Namwah", "Apple"]);
  });

  it("handles events spanning multiple years", () => {
    const e1 = makeEvent({ expectedDate: new Date(2026, 5, 1) });  // June 2026
    const e2 = makeEvent({ expectedDate: new Date(2027, 5, 1) });  // June 2027
    const result = groupForecastByMonth([e1, e2]);
    expect(result).toHaveLength(2);
    expect(result[0].monthKey).toBe("2026-06");
    expect(result[1].monthKey).toBe("2027-06");
  });

  it("label is human-readable month and year", () => {
    const event = makeEvent({ expectedDate: new Date(2026, 10, 1) }); // November
    const result = groupForecastByMonth([event]);
    expect(result[0].label).toMatch(/November/);
    expect(result[0].label).toMatch(/2026/);
  });
});
