import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  computeForecast,
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
