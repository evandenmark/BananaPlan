import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const frequencyEnum = pgEnum("frequency", ["monthly", "one_time"]);

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fields = pgTable("fields", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id")
    .references(() => sites.id)
    .notNull(),
  name: text("name").notNull(),
  sizeAcres: numeric("size_acres", { precision: 6, scale: 2 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const varieties = pgTable("varieties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  monthsToFirstBunch: numeric("months_to_first_bunch", {
    precision: 5,
    scale: 2,
  }).notNull(),
  monthsToSubsequentBunch: numeric("months_to_subsequent_bunch", {
    precision: 5,
    scale: 2,
  }).notNull(),
  totalBunchesPerMat: integer("total_bunches_per_mat").notNull(),
  bananasPerBunch: integer("bananas_per_bunch"),
  poundsPerBunch: numeric("pounds_per_bunch", {
    precision: 6,
    scale: 2,
  }).notNull(),
  successRate: numeric("success_rate", { precision: 4, scale: 3 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fieldInventory = pgTable("field_inventory", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id")
    .references(() => fields.id)
    .notNull(),
  varietyId: integer("variety_id")
    .references(() => varieties.id)
    .notNull(),
  numberOfMats: integer("number_of_mats").notNull(),
  plantingDate: date("planting_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .references(() => clients.id)
    .notNull(),
  varietyId: integer("variety_id")
    .references(() => varieties.id)
    .notNull(),
  poundsPerDelivery: numeric("pounds_per_delivery", {
    precision: 8,
    scale: 2,
  }).notNull(),
  frequency: frequencyEnum("frequency").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bunchHarvests = pgTable("bunch_harvests", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id")
    .references(() => fields.id)
    .notNull(),
  varietyId: integer("variety_id")
    .references(() => varieties.id)
    .notNull(),
  bunches: integer("bunches").notNull(),
  harvestDate: date("harvest_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weightHarvests = pgTable("weight_harvests", {
  id: serial("id").primaryKey(),
  varietyId: integer("variety_id")
    .references(() => varieties.id)
    .notNull(),
  pounds: numeric("pounds", { precision: 8, scale: 2 }).notNull(),
  harvestDate: date("harvest_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const sitesRelations = relations(sites, ({ many }) => ({
  fields: many(fields),
}));

export const fieldsRelations = relations(fields, ({ one, many }) => ({
  site: one(sites, { fields: [fields.siteId], references: [sites.id] }),
  inventory: many(fieldInventory),
  bunchHarvests: many(bunchHarvests),
}));

export const varietiesRelations = relations(varieties, ({ many }) => ({
  inventory: many(fieldInventory),
  orders: many(orders),
  bunchHarvests: many(bunchHarvests),
  weightHarvests: many(weightHarvests),
}));

export const fieldInventoryRelations = relations(fieldInventory, ({ one }) => ({
  field: one(fields, {
    fields: [fieldInventory.fieldId],
    references: [fields.id],
  }),
  variety: one(varieties, {
    fields: [fieldInventory.varietyId],
    references: [varieties.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  client: one(clients, { fields: [orders.clientId], references: [clients.id] }),
  variety: one(varieties, {
    fields: [orders.varietyId],
    references: [varieties.id],
  }),
}));

export const bunchHarvestsRelations = relations(bunchHarvests, ({ one }) => ({
  field: one(fields, {
    fields: [bunchHarvests.fieldId],
    references: [fields.id],
  }),
  variety: one(varieties, {
    fields: [bunchHarvests.varietyId],
    references: [varieties.id],
  }),
}));

export const weightHarvestsRelations = relations(weightHarvests, ({ one }) => ({
  variety: one(varieties, {
    fields: [weightHarvests.varietyId],
    references: [varieties.id],
  }),
}));
