"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recordBunchHarvestBatch,
  updateBunchHarvest,
  deleteBunchHarvest,
} from "@/app/actions/harvest";

interface Field {
  id: number;
  name: string;
  siteName: string;
}

interface Variety {
  id: number;
  name: string;
}

export interface RecentHarvest {
  id: number;
  fieldId: number;
  fieldName: string;
  siteName: string;
  varietyId: number;
  varietyName: string;
  bunches: number;
  harvestDate: string;
}

type Mode = "idle" | "harvest-field" | "harvest-count" | "editing";

export function HarvestClient({
  fields,
  fieldVarietyMap,
  recent,
}: {
  fields: Field[];
  fieldVarietyMap: Record<number, Variety[]>;
  recent: RecentHarvest[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [editTarget, setEditTarget] = useState<RecentHarvest | null>(null);
  const [editBunches, setEditBunches] = useState(0);
  const [editDate, setEditDate] = useState("");
  const [editVarietyId, setEditVarietyId] = useState(0);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  function handleFieldSelect(fieldId: number) {
    setSelectedFieldId(fieldId);
    const varieties = fieldVarietyMap[fieldId] ?? [];
    const initial: Record<number, number> = {};
    for (const v of varieties) initial[v.id] = 0;
    setCounts(initial);
    setMode("harvest-count");
  }

  function adjust(varietyId: number, delta: number) {
    setCounts((prev) => ({
      ...prev,
      [varietyId]: Math.max(0, (prev[varietyId] ?? 0) + delta),
    }));
  }

  function handleSubmit() {
    if (!selectedFieldId) return;
    const entries = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([varietyId, bunches]) => ({
        varietyId: parseInt(varietyId),
        bunches,
      }));
    if (entries.length === 0) return;
    startTransition(async () => {
      await recordBunchHarvestBatch(selectedFieldId, entries, today);
      setMode("idle");
      setSelectedFieldId(null);
      setCounts({});
      router.refresh();
    });
  }

  function openEdit(h: RecentHarvest) {
    setEditTarget(h);
    setEditBunches(h.bunches);
    setEditDate(h.harvestDate);
    setEditVarietyId(h.varietyId);
    setMode("editing");
  }

  function handleEditSubmit() {
    if (!editTarget) return;
    startTransition(async () => {
      await updateBunchHarvest(editTarget.id, {
        bunches: editBunches,
        harvestDate: editDate,
        varietyId: editVarietyId,
      });
      setMode("idle");
      setEditTarget(null);
      router.refresh();
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteBunchHarvest(id);
      router.refresh();
    });
  }

  // ── Full-screen overlays ──────────────────────────────────────────────────
  if (mode !== "idle") {
    const selectedField = fields.find((f) => f.id === selectedFieldId);

    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden">
        {/* Field selection */}
        {mode === "harvest-field" && (
          <>
            <div className="flex items-center gap-4 p-4 border-b border-gray-200">
              <button
                onClick={() => setMode("idle")}
                className="text-gray-500 text-2xl leading-none active:opacity-60 transition-opacity"
              >
                ✕
              </button>
              <h2 className="text-xl font-bold text-gray-900">Which field?</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 content-start">
              {fields.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFieldSelect(f.id)}
                  className="bg-gray-50 border-2 border-gray-200 rounded-2xl py-8 flex flex-col items-center justify-center gap-1 active:bg-gray-100 active:scale-95 transition-transform"
                >
                  <span className="text-3xl font-bold text-gray-900">
                    {f.name}
                  </span>
                  <span className="text-sm font-normal text-gray-500">
                    {f.siteName}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Bunch count per variety */}
        {mode === "harvest-count" && selectedField && (
          <>
            <div className="flex items-center gap-4 p-4 border-b border-gray-200">
              <button
                onClick={() => setMode("harvest-field")}
                className="text-sm font-medium text-gray-500 active:opacity-60 transition-opacity"
              >
                ← Back
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedField.name}
                </h2>
                <p className="text-sm text-gray-500">{selectedField.siteName}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(fieldVarietyMap[selectedField.id] ?? []).map((v) => (
                <div
                  key={v.id}
                  className="bg-gray-50 rounded-2xl p-4"
                >
                  <p className="font-semibold text-gray-900 mb-3 text-center text-lg">
                    {v.name}
                  </p>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => adjust(v.id, -1)}
                      className="w-20 h-20 rounded-2xl bg-gray-200 text-4xl font-bold text-gray-700 flex items-center justify-center active:bg-gray-300 active:scale-90 transition-transform"
                    >
                      −
                    </button>
                    <span className="text-5xl font-bold text-gray-900 w-16 text-center tabular-nums">
                      {counts[v.id] ?? 0}
                    </span>
                    <button
                      onClick={() => adjust(v.id, +1)}
                      className="w-20 h-20 rounded-2xl bg-green-600 text-4xl font-bold text-white flex items-center justify-center active:bg-green-700 active:scale-90 transition-transform"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleSubmit}
                disabled={
                  isPending ||
                  Object.values(counts).every((n) => n === 0)
                }
                className="w-full bg-green-700 text-white py-5 rounded-2xl font-bold text-xl disabled:opacity-40 active:scale-95 disabled:active:scale-100 transition-transform"
              >
                {isPending ? "Saving…" : "Submit"}
              </button>
            </div>
          </>
        )}

        {/* Edit harvest */}
        {mode === "editing" && editTarget && (
          <>
            <div className="flex items-center gap-4 p-4 border-b border-gray-200">
              <button
                onClick={() => setMode("idle")}
                className="text-gray-500 text-2xl leading-none active:opacity-60 transition-opacity"
              >
                ✕
              </button>
              <h2 className="text-xl font-bold text-gray-900">Edit Harvest</h2>
            </div>
            <div className="flex-1 p-4 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variety
                </label>
                <select
                  value={editVarietyId}
                  onChange={(e) =>
                    setEditVarietyId(parseInt(e.target.value))
                  }
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
                >
                  {(fieldVarietyMap[editTarget.fieldId] ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bunches
                </label>
                <input
                  type="number"
                  min="1"
                  value={editBunches}
                  onChange={(e) =>
                    setEditBunches(parseInt(e.target.value) || 0)
                  }
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleEditSubmit}
                disabled={isPending}
                className="w-full bg-green-700 text-white py-5 rounded-2xl font-bold text-xl disabled:opacity-40 active:scale-95 disabled:active:scale-100 transition-transform"
              >
                {isPending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Idle view ─────────────────────────────────────────────────────────────
  return (
    <>
      <button
        onClick={() => setMode("harvest-field")}
        className="w-full bg-green-700 text-white py-10 rounded-2xl font-bold text-3xl mb-8 active:bg-green-800 active:scale-95 transition-transform"
      >
        Harvest
      </button>

      {recent.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Recent Harvests
          </h2>
          <div className="space-y-2">
            {recent.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900 text-base">
                    {h.siteName} {h.fieldName} · {h.varietyName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {h.bunches} bunches ·{" "}
                    {new Date(
                      h.harvestDate + "T00:00:00"
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(h)}
                    className="text-base text-blue-600 font-semibold px-3 py-2 active:opacity-60 transition-opacity"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(h.id)}
                    disabled={isPending}
                    className="text-base text-red-600 font-semibold px-3 py-2 disabled:opacity-40 active:opacity-60 transition-opacity"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
