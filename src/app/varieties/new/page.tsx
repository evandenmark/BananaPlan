import { createVariety } from "@/app/actions/varieties";
import Link from "next/link";

export default function NewVarietyPage() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/varieties" className="text-green-700 font-medium">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Variety</h1>
      </div>

      <form action={createVariety} className="space-y-4">
        <VarietyFields />
        <button
          type="submit"
          className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-base"
        >
          Save Variety
        </button>
      </form>
    </div>
  );
}

export function VarietyFields({
  defaults,
}: {
  defaults?: {
    name?: string;
    description?: string;
    monthsToFirstBunch?: string;
    monthsToSubsequentBunch?: string;
    totalBunchesPerMat?: number;
    bananasPerBunch?: number | null;
    poundsPerBunch?: string;
    successRate?: string;
    notes?: string;
  };
}) {
  return (
    <>
      <Field label="Name" name="name" required defaultValue={defaults?.name} />
      <Field
        label="Description"
        name="description"
        defaultValue={defaults?.description ?? ""}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Months to first bunch"
          name="monthsToFirstBunch"
          type="number"
          step="0.5"
          required
          defaultValue={defaults?.monthsToFirstBunch}
        />
        <Field
          label="Months to subsequent"
          name="monthsToSubsequentBunch"
          type="number"
          step="0.5"
          required
          defaultValue={defaults?.monthsToSubsequentBunch}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Total bunches per mat"
          name="totalBunchesPerMat"
          type="number"
          required
          defaultValue={defaults?.totalBunchesPerMat?.toString()}
        />
        <Field
          label="Bananas per bunch"
          name="bananasPerBunch"
          type="number"
          defaultValue={defaults?.bananasPerBunch?.toString() ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Lbs per bunch"
          name="poundsPerBunch"
          type="number"
          step="0.1"
          required
          defaultValue={defaults?.poundsPerBunch}
        />
        <Field
          label="Success rate (0–1)"
          name="successRate"
          type="number"
          step="0.01"
          min="0"
          max="1"
          required
          defaultValue={defaults?.successRate}
        />
      </div>
      <Field
        label="Notes"
        name="notes"
        defaultValue={defaults?.notes ?? ""}
      />
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        step={step}
        min={min}
        max={max}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900 bg-white"
      />
    </div>
  );
}
