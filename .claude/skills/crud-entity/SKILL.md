---
name: crud-entity
description: Add or extend a managed entity in BananaPlan — list page, new/edit forms, server actions, and tests — following the conventions used by fields, sites, varieties, clients, and orders. Use when adding a new thing the operator can create, edit, and delete, or when adding a page or form to an existing one.
---

# Add a managed entity

Five entities already follow this shape: `sites`, `fields`, `varieties`,
`clients`, `orders`. Copy the closest one rather than inventing a layout —
`varieties` is the best template for a simple entity, `orders` for one with a
parent.

Architecture rules are in
[ADR 0001](../../../docs/decisions/0001-server-actions-and-server-components.md):
Server Components read, Server Actions write, no API routes.

## File layout

For an entity `widgets`:

```
src/app/actions/widgets.ts               create / update / delete
src/app/actions/__tests__/widgets.test.ts
src/app/widgets/page.tsx                 list
src/app/widgets/new/page.tsx             create form
src/app/widgets/[id]/edit/page.tsx       edit form
src/app/widgets/[id]/page.tsx            detail — only if there is more to show
```

## 1. Actions — `src/app/actions/widgets.ts`

```ts
"use server";

import { db } from "@/db";
import { widgets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidateFor } from "@/lib/revalidate";

export async function createWidget(formData: FormData) {
  await db.insert(widgets).values({
    name: formData.get("name") as string,
    notes: (formData.get("notes") as string) || null,
  });
  revalidateFor(["widgets"]);
  redirect("/widgets");
}

export async function updateWidget(id: number, formData: FormData) {
  await db.update(widgets).set({ /* ... */ updatedAt: new Date() })
    .where(eq(widgets.id, id));
  revalidateFor(["widgets"], { "/widgets/[id]": id });
  redirect("/widgets");
}

export async function deleteWidget(id: number) {
  await db.delete(widgets).where(eq(widgets.id, id));
  revalidateFor(["widgets"]);
}
```

Conventions that are load-bearing:

- `"use server"` at the top of the file, not per function.
- `FormData` in, for create/update invoked by a form. Updates take
  `(id: number, formData: FormData)`.
- Optional text is `(formData.get("x") as string) || null` — empty string must
  become `null`, not `""`.
- Integers: `parseInt(...)`. **`numeric` columns stay strings** — pass
  `formData.get("pounds") as string` straight through. Do not `parseFloat` on
  the way in.
- `updatedAt: new Date()` on every update, if the table has the column.
- **`revalidateFor([...tables])` before the `redirect`** — never a hand-written
  `revalidatePath` ([ADR 0008](../../../docs/decisions/0008-centralized-revalidation.md)).
  Pass the concrete id for a dynamic route when the action knows it; omit it to
  invalidate every instance.

**Register the new entity's routes** in `ROUTES_BY_TABLE` in
[`src/lib/revalidate.ts`](../../../src/lib/revalidate.ts) — add a row for the new
table, and add the new pages to the rows of **every** table they read. A list
page joining varieties belongs in the `varieties` row too. This is the step that
gets forgotten; nothing enforces it, and a page missing from the map is
stale-able and invisible.

## 2. List page — `src/app/widgets/page.tsx`

An `async` Server Component that queries `db` directly. Copy
`src/app/varieties/page.tsx`. It shows the conventions in place:

- header row with `<h1 className="text-2xl font-bold text-gray-900">` and a
  `+ Add` link to `/widgets/new`
- empty state: `No widgets yet. Add one to get started.`
- cards: `bg-white rounded-xl border border-gray-200 p-4`, stacked in
  `space-y-3`
- primary action green (`bg-green-700` / `text-green-700`), delete
  `text-red-600`
- tap feedback on everything touchable: `active:scale-95` on buttons,
  `active:opacity-60` on text links — this app is used one-handed on a phone
  ([constitution](../../../docs/constitution.md) §2)
- inline delete via a form with an inline `"use server"` closure calling the
  action

Order results explicitly (`asc(widgets.name)` or `desc(widgets.createdAt)`).
Unordered lists reshuffle between renders.

## 3. Forms — `new` and `[id]/edit`

Plain `<form action={createWidget}>` posting to the Server Action. No client
state unless fields genuinely depend on each other — the only Client Component
form in the app is `harvest-form.tsx`, and it earns it with dependent dropdowns.

- `name` attributes must match exactly what the action reads from `FormData`.
- Use real input types (`type="number"`, `type="date"`, `step="0.01"`) — they
  select the right phone keyboard.
- Edit pages bind with `.bind(null, id)` on the update action.
- Route params are a Promise in Next 16: `const { id } = await params;`

## 4. Tests — `src/app/actions/__tests__/widgets.test.ts`

Copy `varieties.test.ts`. The pattern:

```ts
vi.mock("@/db", () => ({ db: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
```

then build the chain in `beforeEach`:

```ts
mockInsertValues = vi.fn().mockResolvedValue([]);
vi.mocked(db.insert).mockReturnValue({ values: mockInsertValues } as any);
```

Assert the **exact** object passed to `.values()` / `.set()`, and assert the
resulting `revalidatePath` calls — a missing revalidate is the characteristic bug
of this architecture and the tests are the only thing that catches it. Mocking
`next/cache` still works: `revalidateFor` calls `revalidatePath` underneath, so
existing assertions see the paths it emits. The map itself is covered separately
in `src/lib/__tests__/revalidate.test.ts`.

Never write `new Date("2026-03-01")` in a test. That parses as UTC and lands on
February 28 in Hawaii. Use `new Date(2026, 2, 1)`.

## 5. Navigation

The bottom bar (`src/components/nav.tsx`) holds five items and is full: Home,
Fields, Harvest, Forecast, More. **Do not add a sixth** — link the new entity
from `/more` instead, which is where Sites, Varieties, Clients, and the weight
log already live.

## 6. Finish

```bash
npm run test:run && npx tsc --noEmit
```

If the entity required a schema change, run the `schema-change` skill for the
database side. If its shape involved a real choice, run `log-decision`.
