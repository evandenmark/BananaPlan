import { db } from "@/db";
import { clients, orders, varieties } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { deleteClient } from "@/app/actions/clients";
import { deleteOrder } from "@/app/actions/orders";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clientId = parseInt(id);

  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .then((r) => r[0]);

  if (!client) notFound();

  const clientOrders = await db
    .select({
      id: orders.id,
      varietyName: varieties.name,
      poundsPerDelivery: orders.poundsPerDelivery,
      frequency: orders.frequency,
      startDate: orders.startDate,
      endDate: orders.endDate,
      isActive: orders.isActive,
      notes: orders.notes,
    })
    .from(orders)
    .innerJoin(varieties, eq(orders.varietyId, varieties.id))
    .where(eq(orders.clientId, clientId))
    .orderBy(asc(orders.startDate));

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/clients" className="text-green-700 font-medium">
          ← Clients
        </Link>
      </div>

      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
        <div className="flex gap-3">
          <Link
            href={`/clients/${clientId}/edit`}
            className="text-sm text-green-700 font-medium"
          >
            Edit
          </Link>
          <form
            action={async () => {
              "use server";
              await deleteClient(clientId);
            }}
          >
            <button type="submit" className="text-sm text-red-600 font-medium">
              Delete
            </button>
          </form>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">Orders</h2>
        <Link
          href={`/clients/${clientId}/orders/new`}
          className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          + Add Order
        </Link>
      </div>

      {clientOrders.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No orders yet.</p>
      ) : (
        <div className="space-y-2">
          {clientOrders.map((order) => (
            <div
              key={order.id}
              className={`bg-white rounded-xl border border-gray-200 p-4 ${
                !order.isActive ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {order.varietyName}
                    </p>
                    {!order.isActive && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {order.poundsPerDelivery} lbs ·{" "}
                    {order.frequency === "one_time" ? "one time" : "monthly"}
                  </p>
                  <p className="text-sm text-gray-500">
                    From {order.startDate}
                    {order.endDate ? ` to ${order.endDate}` : " (ongoing)"}
                  </p>
                  {order.notes && (
                    <p className="text-sm text-gray-400 mt-1">{order.notes}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-3 shrink-0">
                  <Link
                    href={`/clients/${clientId}/orders/${order.id}/edit`}
                    className="text-sm text-green-700 font-medium px-2 py-1"
                  >
                    Edit
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await deleteOrder(order.id, clientId);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-sm text-red-600 font-medium px-2 py-1"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
