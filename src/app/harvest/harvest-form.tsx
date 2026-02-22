"use client";

import { useState } from "react";
import { recordBunchHarvest } from "@/app/actions/harvest";

interface Field {
  id: number;
  name: string;
  siteName: string;
}

interface Variety {
  id: number;
  name: string;
}

export function HarvestForm({
  fields,
  fieldVarietyMap,
}: {
  fields: Field[];
  fieldVarietyMap: Record<number, Variety[]>;
}) {
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const today = new Date().toISOString().split("T")[0];

  const varieties = selectedFieldId ? (fieldVarietyMap[selectedFieldId] ?? []) : [];

  return (
    <form
      action={recordBunchHarvest}
      className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field <span className="text-red-500">*</span>
        </label>
        <select
          name="fieldId"
          required
          value={selectedFieldId ?? ""}
          onChange={(e) =>
            setSelectedFieldId(e.target.value ? parseInt(e.target.value) : null)
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white"
        >
          <option value="">Select field...</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.siteName} — {f.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Variety <span className="text-red-500">*</span>
        </label>
        <select
          name="varietyId"
          required
          disabled={!selectedFieldId || varieties.length === 0}
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white disabled:opacity-50"
        >
          <option value="">
            {!selectedFieldId
              ? "Select a field first"
              : varieties.length === 0
              ? "No varieties in this field"
              : "Select variety..."}
          </option>
          {varieties.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bunches <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="bunches"
            required
            min="1"
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="harvestDate"
            required
            defaultValue={today}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <input
          type="text"
          name="notes"
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-green-700 text-white py-4 rounded-xl font-bold text-lg"
      >
        Record Harvest
      </button>
    </form>
  );
}
