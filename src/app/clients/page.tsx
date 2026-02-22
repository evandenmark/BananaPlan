import { db } from "@/db";
import { clients, orders } from "@/db/schema";
import { eq, count, asc } from "drizzle-orm";
import Link from "next/link";

export default async function ClientsPage() {
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .orderBy(asc(clients.name));

  const orderCounts = await db
    .select({ clientId: orders.clientId, count: count() })
    .from(orders)
    .where(eq(orders.isActive, true))
    .groupBy(orders.clientId);

  const countMap: Record<number, number> = {};
  for (const o of orderCounts) countMap[o.clientId] = Number(o.count);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <Link
          href="/clients/new"
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No clients yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4"
            >
              <span className="font-medium text-gray-900">{c.name}</span>
              <span className="text-sm text-gray-500">
                {countMap[c.id] ?? 0} active orders
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
