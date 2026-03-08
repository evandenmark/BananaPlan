import { db } from "@/db";
import { orders, varieties } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { updateOrder } from "@/app/actions/orders";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const { id, orderId } = await params;
  const clientId = parseInt(id);
  const orderIdNum = parseInt(orderId);

  const order = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderIdNum))
    .then((r) => r[0]);

  if (!order) notFound();

  const allVarieties = await db
    .select()
    .from(varieties)
    .orderBy(asc(varieties.name));

  const action = async (formData: FormData) => {
    "use server";
    await updateOrder(orderIdNum, clientId, formData);
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/clients/${clientId}`}
          className="text-green-700 font-medium"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Order</h1>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Variety <span className="text-red-500">*</span>
          </label>
          <select
            name="varietyId"
            required
            defaultValue={order.varietyId}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          >
            {allVarieties.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lbs per delivery <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="poundsPerDelivery"
            required
            step="0.1"
            min="0"
            defaultValue={order.poundsPerDelivery}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Frequency <span className="text-red-500">*</span>
          </label>
          <select
            name="frequency"
            required
            defaultValue={order.frequency}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          >
            <option value="monthly">Monthly</option>
            <option value="one_time">One time</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={order.startDate}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End date
            </label>
            <input
              type="date"
              name="endDate"
              defaultValue={order.endDate ?? ""}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            name="isActive"
            defaultValue={order.isActive ? "true" : "false"}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <input
            type="text"
            name="notes"
            defaultValue={order.notes ?? ""}
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
