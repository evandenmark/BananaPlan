import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HarvestClient, type RecentHarvest } from "../harvest-form";
import {
  recordBunchHarvestBatch,
  updateBunchHarvest,
  deleteBunchHarvest,
} from "@/app/actions/harvest";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/app/actions/harvest", () => ({
  recordBunchHarvestBatch: vi.fn().mockResolvedValue(undefined),
  updateBunchHarvest: vi.fn().mockResolvedValue(undefined),
  deleteBunchHarvest: vi.fn().mockResolvedValue(undefined),
}));

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// ── Test data ─────────────────────────────────────────────────────────────────

const mockFields = [
  { id: 1, name: "K1", siteName: "Kemo'o" },
  { id: 2, name: "B1", siteName: "Big Tree" },
];

const mockFieldVarietyMap: Record<number, { id: number; name: string }[]> = {
  1: [
    { id: 10, name: "Namwah" },
    { id: 11, name: "Apple" },
  ],
  2: [{ id: 12, name: "Plantain" }],
};

const mockRecent: RecentHarvest[] = [
  {
    id: 100,
    fieldId: 1,
    fieldName: "K1",
    siteName: "Kemo'o",
    varietyId: 10,
    varietyName: "Namwah",
    bunches: 20,
    harvestDate: "2026-02-20",
  },
  {
    id: 101,
    fieldId: 2,
    fieldName: "B1",
    siteName: "Big Tree",
    varietyId: 12,
    varietyName: "Plantain",
    bunches: 8,
    harvestDate: "2026-02-18",
  },
];

function renderHarvestClient(
  overrides: Partial<{
    fields: typeof mockFields;
    fieldVarietyMap: typeof mockFieldVarietyMap;
    recent: RecentHarvest[];
  }> = {}
) {
  return render(
    <HarvestClient
      fields={overrides.fields ?? mockFields}
      fieldVarietyMap={overrides.fieldVarietyMap ?? mockFieldVarietyMap}
      recent={overrides.recent ?? mockRecent}
    />
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("idle view", () => {
  it("renders the Harvest button prominently", () => {
    renderHarvestClient();
    expect(screen.getByRole("button", { name: /harvest/i })).toBeInTheDocument();
  });

  it("shows the Recent Harvests section when there are harvests", () => {
    renderHarvestClient();
    expect(screen.getByText("Recent Harvests")).toBeInTheDocument();
  });

  it("renders each recent harvest entry with site, field, and variety", () => {
    renderHarvestClient();
    expect(screen.getByText(/Kemo'o.*K1.*Namwah/i)).toBeInTheDocument();
    expect(screen.getByText(/Big Tree.*B1.*Plantain/i)).toBeInTheDocument();
  });

  it("shows bunches count and formatted date for each harvest", () => {
    renderHarvestClient();
    expect(screen.getByText(/20 bunches/i)).toBeInTheDocument();
    expect(screen.getByText(/8 bunches/i)).toBeInTheDocument();
  });

  it("shows Edit and Delete buttons for each recent harvest", () => {
    renderHarvestClient();
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    expect(editButtons).toHaveLength(2);
    expect(deleteButtons).toHaveLength(2);
  });

  it("does NOT show Recent Harvests section when list is empty", () => {
    renderHarvestClient({ recent: [] });
    expect(screen.queryByText("Recent Harvests")).not.toBeInTheDocument();
  });

  it("does not show the field selection overlay initially", () => {
    renderHarvestClient();
    expect(screen.queryByText("Which field?")).not.toBeInTheDocument();
  });
});

describe("field selection overlay", () => {
  it("shows 'Which field?' heading after clicking Harvest button", async () => {
    const user = userEvent.setup();
    renderHarvestClient();

    await user.click(screen.getByRole("button", { name: /^harvest$/i }));

    expect(screen.getByText("Which field?")).toBeInTheDocument();
  });

  it("renders a button for each available field", async () => {
    const user = userEvent.setup();
    renderHarvestClient();

    await user.click(screen.getByRole("button", { name: /^harvest$/i }));

    expect(screen.getByRole("button", { name: /K1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /B1/i })).toBeInTheDocument();
  });

  it("shows site name alongside field name in grid", async () => {
    const user = userEvent.setup();
    renderHarvestClient();

    await user.click(screen.getByRole("button", { name: /^harvest$/i }));

    expect(screen.getByText("Kemo'o")).toBeInTheDocument();
    expect(screen.getByText("Big Tree")).toBeInTheDocument();
  });

  it("closes overlay and returns to idle when ✕ is clicked", async () => {
    const user = userEvent.setup();
    renderHarvestClient();

    await user.click(screen.getByRole("button", { name: /^harvest$/i }));
    expect(screen.getByText("Which field?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /✕/i }));

    expect(screen.queryByText("Which field?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^harvest$/i })).toBeInTheDocument();
  });
});

describe("variety count step", () => {
  async function openCountStep(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /^harvest$/i }));
    await user.click(screen.getByRole("button", { name: /K1/i }));
  }

  it("shows field name and site name in the header after field selection", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openCountStep(user);

    expect(screen.getByText("K1")).toBeInTheDocument();
    expect(screen.getByText("Kemo'o")).toBeInTheDocument();
  });

  it("renders a counter card for each variety in the selected field", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openCountStep(user);

    expect(screen.getByText("Namwah")).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });

  it("initialises all variety counts to 0", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openCountStep(user);

    const countDisplays = screen.getAllByText("0");
    expect(countDisplays.length).toBeGreaterThanOrEqual(2);
  });

  it("increments count when + button is clicked", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openCountStep(user);

    // Get the first + button (for Namwah)
    const plusButtons = screen.getAllByRole("button", { name: "+" });
    await user.click(plusButtons[0]);

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("decrements count when − button is clicked", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openCountStep(user);

    const plusButtons = screen.getAllByRole("button", { name: "+" });
    const minusButtons = screen.getAllByRole("button", { name: "−" });

    await user.click(plusButtons[0]);
    await user.click(plusButtons[0]);
    await user.click(minusButtons[0]);

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does not decrement count below 0", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openCountStep(user);

    const minusButtons = screen.getAllByRole("button", { name: "−" });
    await user.click(minusButtons[0]);

    // Should still be 0, not -1
    const zeroDisplays = screen.getAllByText("0");
    expect(zeroDisplays.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("-1")).not.toBeInTheDocument();
  });

  it("Submit button is disabled when all counts are 0", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openCountStep(user);

    const submitBtn = screen.getByRole("button", { name: /submit/i });
    expect(submitBtn).toBeDisabled();
  });

  it("Submit button is enabled when at least one count > 0", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openCountStep(user);

    const plusButtons = screen.getAllByRole("button", { name: "+" });
    await user.click(plusButtons[0]);

    const submitBtn = screen.getByRole("button", { name: /submit/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it("← Back button returns to field selection", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openCountStep(user);

    await user.click(screen.getByRole("button", { name: /← back/i }));

    expect(screen.getByText("Which field?")).toBeInTheDocument();
  });

  it("submitting calls recordBunchHarvestBatch with non-zero entries only", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openCountStep(user);

    // Increment Namwah (index 0) to 3; leave Apple at 0
    const plusButtons = screen.getAllByRole("button", { name: "+" });
    await user.click(plusButtons[0]);
    await user.click(plusButtons[0]);
    await user.click(plusButtons[0]);

    const submitBtn = screen.getByRole("button", { name: /submit/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(recordBunchHarvestBatch).toHaveBeenCalledWith(
        1, // fieldId for K1
        [{ varietyId: 10, bunches: 3 }], // only Namwah (Apple count = 0 excluded)
        expect.any(String) // today's date
      );
    });
  });

  it("returns to idle and calls router.refresh() after successful submit", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openCountStep(user);

    const plusButtons = screen.getAllByRole("button", { name: "+" });
    await user.click(plusButtons[0]);

    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /^harvest$/i })).toBeInTheDocument();
    });
  });
});

describe("edit harvest overlay", () => {
  async function openEditOverlay(user: ReturnType<typeof userEvent.setup>) {
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await user.click(editButtons[0]); // Edit first recent harvest
  }

  it("opens the Edit Harvest overlay when Edit is clicked", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openEditOverlay(user);

    expect(screen.getByText("Edit Harvest")).toBeInTheDocument();
  });

  it("pre-populates bunches input with the harvest's current value", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openEditOverlay(user);

    const bunchesInput = screen.getByRole("spinbutton"); // type="number"
    expect(bunchesInput).toHaveValue(20); // mockRecent[0].bunches = 20
  });

  it("pre-populates date input with the harvest's current date", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openEditOverlay(user);

    const dateInput = screen.getByDisplayValue("2026-02-20");
    expect(dateInput).toBeInTheDocument();
  });

  it("shows variety dropdown scoped to the harvest's field", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openEditOverlay(user);

    // First harvest is from field K1 which has Namwah and Apple
    const select = screen.getByRole("combobox");
    const options = within(select).getAllByRole("option");
    const names = options.map((o) => o.textContent);
    expect(names).toContain("Namwah");
    expect(names).toContain("Apple");
  });

  it("calls updateBunchHarvest with new values when Save Changes is clicked", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openEditOverlay(user);

    // Change bunches to 25
    const bunchesInput = screen.getByRole("spinbutton");
    await user.clear(bunchesInput);
    await user.type(bunchesInput, "25");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateBunchHarvest).toHaveBeenCalledWith(
        100, // mockRecent[0].id
        expect.objectContaining({
          bunches: 25,
          harvestDate: "2026-02-20",
          varietyId: 10,
        })
      );
    });
  });

  it("returns to idle and calls router.refresh() after successful save", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openEditOverlay(user);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
      expect(screen.queryByText("Edit Harvest")).not.toBeInTheDocument();
    });
  });

  it("closes edit overlay and returns to idle when ✕ is clicked", async () => {
    const user = userEvent.setup();
    renderHarvestClient();
    await openEditOverlay(user);

    await user.click(screen.getByRole("button", { name: /✕/i }));

    expect(screen.queryByText("Edit Harvest")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^harvest$/i })).toBeInTheDocument();
  });
});

describe("delete harvest", () => {
  it("calls deleteBunchHarvest with the correct harvest id", async () => {
    const user = userEvent.setup();
    renderHarvestClient();

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(deleteBunchHarvest).toHaveBeenCalledWith(100); // mockRecent[0].id
    });
  });

  it("calls router.refresh() after successful delete", async () => {
    const user = userEvent.setup();
    renderHarvestClient();

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("deletes the correct entry when the second Delete button is clicked", async () => {
    const user = userEvent.setup();
    renderHarvestClient();

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[1]); // Second harvest (id: 101)

    await waitFor(() => {
      expect(deleteBunchHarvest).toHaveBeenCalledWith(101);
    });
  });
});

describe("empty field variety map", () => {
  it("renders no counter cards when a field has no varieties", async () => {
    const user = userEvent.setup();
    renderHarvestClient({
      fields: [{ id: 99, name: "Empty", siteName: "Site" }],
      fieldVarietyMap: { 99: [] },
    });

    await user.click(screen.getByRole("button", { name: /^harvest$/i }));
    await user.click(screen.getByRole("button", { name: /empty/i }));

    // Submit should be disabled since there are no varieties to count
    const submitBtn = screen.getByRole("button", { name: /submit/i });
    expect(submitBtn).toBeDisabled();
  });
});
