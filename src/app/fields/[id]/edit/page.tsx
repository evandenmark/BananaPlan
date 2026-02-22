import { db } from "@/db";
import { fields } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { updateField } from "@/app/actions/fields";

export default async function EditFieldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const field = await db
    .select()
    .from(fields)
    .where(eq(fields.id, parseInt(id)))
    .then((r) => r[0]);

  if (!field) notFound();

  const action = async (formData: FormData) => {
    "use server";
    await updateField(field.id, formData);
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/fields/${field.id}`} className="text-green-700 font-medium">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit {field.name}</h1>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Field name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            defaultValue={field.name}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Size (acres)
          </label>
          <input
            type="number"
            name="sizeAcres"
            step="0.1"
            min="0"
            defaultValue={field.sizeAcres ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <input
            type="text"
            name="notes"
            defaultValue={field.notes ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            name="isActive"
            defaultValue={field.isActive ? "true" : "false"}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-base"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
