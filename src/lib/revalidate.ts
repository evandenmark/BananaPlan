import { revalidatePath } from "next/cache";

/**
 * Which routes display which tables, and therefore what a mutation must
 * revalidate.
 *
 * Server Actions call `revalidateFor` with the tables they wrote, rather than
 * listing routes by hand. Keeping the mapping in one place is the point: the
 * fan-out is wider than it looks (a variety edit is visible on nine routes),
 * and hand-written lists drift the moment a page is added.
 *
 * When you add a page, add it here for every table it reads. When you add a
 * table, add a row.
 */
const ROUTES_BY_TABLE = {
  sites: ["/", "/fields", "/fields/[id]", "/harvest", "/forecast", "/sites", "/more"],
  // `/sites` reads fields to decide whether a site can be deleted (ADR 0012),
  // and `/varieties` reads all four tables that reference a variety for the
  // same reason. Those pages show a destructive control based on these counts,
  // so a stale count is a button that lies.
  fields: ["/", "/fields", "/fields/[id]", "/harvest", "/forecast", "/sites"],
  fieldInventory: [
    "/",
    "/fields",
    "/fields/[id]",
    "/harvest",
    "/forecast",
    "/varieties",
  ],
  varieties: [
    "/",
    "/fields",
    "/fields/[id]",
    "/harvest",
    "/forecast",
    "/clients/[id]",
    "/varieties",
    "/weight-log",
    "/more",
  ],
  clients: ["/", "/clients", "/clients/[id]", "/more"],
  orders: ["/", "/clients", "/clients/[id]", "/forecast", "/more", "/varieties"],
  bunchHarvests: ["/", "/harvest", "/forecast", "/varieties"],
  weightHarvests: ["/", "/forecast", "/weight-log", "/varieties"],
} as const satisfies Record<string, readonly string[]>;

export type Table = keyof typeof ROUTES_BY_TABLE;

/** Route patterns containing a dynamic segment, which need special handling. */
type DynamicRoute = "/fields/[id]" | "/clients/[id]";

/**
 * Revalidate every route that displays data from `tables`.
 *
 * Pass the concrete id for a dynamic route when the action knows it — the
 * mutation then invalidates that one page instead of every instance:
 *
 *     revalidateFor(["orders"], { "/clients/[id]": clientId });
 */
export function revalidateFor(
  tables: readonly Table[],
  concrete: Partial<Record<DynamicRoute, number | string>> = {}
): void {
  const routes = new Set<string>();
  for (const table of tables) {
    for (const route of ROUTES_BY_TABLE[table]) routes.add(route);
  }

  for (const route of routes) {
    if (!route.includes("[")) {
      revalidatePath(route);
      continue;
    }

    const id = concrete[route as DynamicRoute];
    if (id !== undefined) {
      revalidatePath(route.replace(/\[\w+\]/, String(id)));
    } else {
      // No specific id — invalidate every instance of the route.
      revalidatePath(route, "page");
    }
  }
}
