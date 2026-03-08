import { createSite } from "@/app/actions/sites";
import Link from "next/link";

export default function NewSitePage() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sites" className="text-green-700 font-medium">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Site</h1>
      </div>

      <form action={createSite} className="space-y-4">
        <SiteFields />
        <button
          type="submit"
          className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-base active:scale-95 transition-transform"
        >
          Save Site
        </button>
      </form>
    </div>
  );
}

export function SiteFields({
  defaults,
}: {
  defaults?: { name?: string; description?: string };
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name<span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          type="text"
          name="name"
          required
          defaultValue={defaults?.name}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900 bg-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <input
          type="text"
          name="description"
          defaultValue={defaults?.description ?? ""}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900 bg-white"
        />
      </div>
    </>
  );
}
