import { db } from "@/db";
import { sites } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteFields } from "@/app/sites/new/page";
import { updateSite } from "@/app/actions/sites";

export default async function EditSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = await db
    .select()
    .from(sites)
    .where(eq(sites.id, parseInt(id)))
    .then((r) => r[0]);

  if (!site) notFound();

  const action = async (formData: FormData) => {
    "use server";
    await updateSite(site.id, formData);
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sites" className="text-green-700 font-medium">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Site</h1>
      </div>

      <form action={action} className="space-y-4">
        <SiteFields
          defaults={{
            name: site.name,
            description: site.description ?? "",
          }}
        />
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
