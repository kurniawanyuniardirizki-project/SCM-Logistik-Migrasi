import {
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core user table backing auth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const bananaReports = mysqlTable(
  "banana_reports",
  {
    id: int("id").autoincrement().primaryKey(),
    reportDate: varchar("reportDate", { length: 10 }).notNull().unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    reportDateIndex: index("banana_reports_report_date_idx").on(
      table.reportDate
    ),
  })
);

export type BananaReport = typeof bananaReports.$inferSelect;
export type InsertBananaReport = typeof bananaReports.$inferInsert;

export const bananaReportItems = mysqlTable(
  "banana_report_items",
  {
    id: int("id").autoincrement().primaryKey(),
    reportId: int("reportId")
      .notNull()
      .references(() => bananaReports.id, { onDelete: "cascade" }),
    skuOrder: int("skuOrder").notNull(),
    skuName: varchar("skuName", { length: 255 }).notNull(),
    logistics14: decimal("logistics14", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    logistics15: decimal("logistics15", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    logistics16: decimal("logistics16", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    production14: decimal("production14", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    production15: decimal("production15", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    production16: decimal("production16", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    additional14: decimal("additional14", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    additional15: decimal("additional15", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    additional16: decimal("additional16", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    doQty: decimal("doQty", { precision: 10, scale: 2 }).default("0").notNull(),
    remark: text("remark"),
    rejectQty: decimal("rejectQty", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
  },
  table => ({
    reportIdIndex: index("banana_report_items_report_id_idx").on(
      table.reportId
    ),
  })
);

export type BananaReportItem = typeof bananaReportItems.$inferSelect;
export type InsertBananaReportItem = typeof bananaReportItems.$inferInsert;

export const stockTransactions = mysqlTable(
  "stock_transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    movementType: mysqlEnum("movementType", ["in", "out", "reject"]).notNull(),
    skuName: varchar("skuName", { length: 255 }).notNull(),
    step: int("step").notNull(),
    qty: decimal("qty", { precision: 10, scale: 2 }).notNull(),
    reason: varchar("reason", { length: 64 })
      .default("stock produksi")
      .notNull(),
    movedAt: timestamp("movedAt").defaultNow().notNull(),
    stockSource: varchar("stockSource", { length: 32 }),
    remark: text("remark"),
    transferId: varchar("transferId", { length: 36 }),
    relatedSku: varchar("relatedSku", { length: 255 }),
  },
  table => ({
    movedAtIndex: index("stock_transactions_moved_at_idx").on(table.movedAt),
    skuStepIndex: index("stock_transactions_sku_step_idx").on(
      table.skuName,
      table.step
    ),
  })
);

export type StockTransaction = typeof stockTransactions.$inferSelect;
export type InsertStockTransaction = typeof stockTransactions.$inferInsert;
