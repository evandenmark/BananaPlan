import { createClient } from "@/app/actions/clients";
import Link from "next/link";

export default function NewClientPage() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients" className="text-green-700 font-medium">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Client</h1>
      </div>

      <form action={createClient} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-base"
        >
          Save Client
        </button>
      </form>
    </div>
  );
}
