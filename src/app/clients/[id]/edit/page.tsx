import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { updateClient } from "@/app/actions/clients";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, parseInt(id)))
    .then((r) => r[0]);

  if (!client) notFound();

  const action = async (formData: FormData) => {
    "use server";
    await updateClient(client.id, formData);
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${client.id}`} className="text-green-700 font-medium">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Client</h1>
      </div>
      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            defaultValue={client.name}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-base active:scale-95 transition-transform"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
