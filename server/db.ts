import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import { allocateStockOut, type StockOutSelection } from "./stock-allocation";
import {
  buildStockDailySnapshot,
  classifyStockSource,
  type StockBalanceAggregate,
  type StockMovement,
  type StockSource,
} from "./stock-ledger";
import {
  bananaReportItems,
  bananaReports,
  InsertBananaReportItem,
  StockTransaction,
  InsertUser,
  stockTransactions,
  users,
} from "../drizzle/schema";
import { BUSINESS_TIME_ZONE } from "../shared/const";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      const value = user[field] ?? null;
      values[field] = value;
      updateSet[field] = value;
    }
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function getBananaReportByDate(reportDate: string) {
  const db = await getDb();
  if (!db) return undefined;

  const reportRows = await db
    .select()
    .from(bananaReports)
    .where(eq(bananaReports.reportDate, reportDate))
    .limit(1);
  const report = reportRows[0];
  if (!report) return undefined;

  const items = await db
    .select()
    .from(bananaReportItems)
    .where(eq(bananaReportItems.reportId, report.id))
    .orderBy(bananaReportItems.skuOrder);

  return { ...report, items };
}

export async function listBananaReports() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bananaReports)
    .orderBy(desc(bananaReports.reportDate))
    .limit(60);
}

export type SaveBananaReportInput = {
  reportDate: string;
  items: Omit<InsertBananaReportItem, "reportId">[];
};

export async function saveBananaReport(input: SaveBananaReportInput) {
  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia");

  await db.transaction(async tx => {
    const existing = await tx
      .select({ id: bananaReports.id })
      .from(bananaReports)
      .where(eq(bananaReports.reportDate, input.reportDate))
      .limit(1);

    let reportId: number;
    if (existing[0]) {
      reportId = existing[0].id;
      await tx
        .update(bananaReports)
        .set({ updatedAt: new Date() })
        .where(eq(bananaReports.id, reportId));
      await tx
        .delete(bananaReportItems)
        .where(eq(bananaReportItems.reportId, reportId));
    } else {
      const inserted = await tx
        .insert(bananaReports)
        .values({ reportDate: input.reportDate });
      reportId = Number(inserted[0].insertId);
    }

    if (input.items.length > 0) {
      await tx.insert(bananaReportItems).values(
        input.items.map(item => ({
          ...item,
          reportId,
          logistics14: item.logistics14 ?? "0",
          logistics15: item.logistics15 ?? "0",
          logistics16: item.logistics16 ?? "0",
          production14: item.production14 ?? "0",
          production15: item.production15 ?? "0",
          production16: item.production16 ?? "0",
          additional14: item.additional14 ?? "0",
          additional15: item.additional15 ?? "0",
          additional16: item.additional16 ?? "0",
          doQty: item.doQty ?? "0",
          rejectQty: item.rejectQty ?? "0",
          remark: item.remark ?? null,
        }))
      );
    }
  });

  return getBananaReportByDate(input.reportDate);
}

export async function deleteBananaReport(reportDate: string) {
  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia");
  await db
    .delete(bananaReports)
    .where(eq(bananaReports.reportDate, reportDate));
  return { success: true } as const;
}

function addCalendarDay(reportDate: string) {
  const [year, month, day] = reportDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function zonedMidnightAsUtc(reportDate: string, timeZone: string) {
  const [year, month, day] = reportDate.split("-").map(Number);
  const targetLocalAsUtc = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  let timestamp = targetLocalAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(timestamp))
        .map(part => [part.type, part.value])
    );
    const observedLocalAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const adjustment = targetLocalAsUtc - observedLocalAsUtc;
    if (adjustment === 0) return new Date(timestamp);
    timestamp += adjustment;
  }

  throw new RangeError(
    `Could not resolve local midnight for ${reportDate} in ${timeZone}`
  );
}

export function getStockDateWindow(
  reportDate: string,
  timeZone = BUSINESS_TIME_ZONE
) {
  return {
    start: zonedMidnightAsUtc(reportDate, timeZone),
    end: zonedMidnightAsUtc(addCalendarDay(reportDate), timeZone),
  };
}

function stockSourceExpression() {
  const source = sql`LOWER(COALESCE(${stockTransactions.stockSource}, ''))`;
  const reason = sql`LOWER(${stockTransactions.reason})`;
  return sql`CASE
    WHEN ${source} = 'production' THEN 'production'
    WHEN ${source} = 'logistics' THEN 'logistics'
    WHEN ${reason} LIKE '%produksi%' OR ${reason} LIKE '%konversi%' OR ${reason} LIKE '%lompat step%' THEN 'production'
    ELSE 'logistics'
  END`;
}

function stockTransactionWindow(
  reportDate: string | undefined,
  timeZone: string
) {
  const window = reportDate
    ? getStockDateWindow(reportDate, timeZone)
    : undefined;
  return window
    ? and(
        gte(stockTransactions.movedAt, window.start),
        lt(stockTransactions.movedAt, window.end)
      )
    : undefined;
}

export async function listStockTransactions(
  reportDate?: string,
  timeZone = BUSINESS_TIME_ZONE
) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(stockTransactions)
    .where(stockTransactionWindow(reportDate, timeZone))
    .orderBy(desc(stockTransactions.movedAt), desc(stockTransactions.id));
}

export async function listStockTransactionHistory(
  fromDate: string,
  toDate: string,
  timeZone = BUSINESS_TIME_ZONE
) {
  const db = await getDb();
  if (!db) return [];

  const from = getStockDateWindow(fromDate, timeZone);
  const to = getStockDateWindow(addCalendarDay(toDate), timeZone);
  return db
    .select()
    .from(stockTransactions)
    .where(
      and(
        gte(stockTransactions.movedAt, from.start),
        lt(stockTransactions.movedAt, to.start)
      )
    )
    .orderBy(asc(stockTransactions.movedAt), asc(stockTransactions.id));
}

export async function listStockBalances(
  reportDate?: string,
  timeZone = BUSINESS_TIME_ZONE
) {
  const cutoff = reportDate
    ? getStockDateWindow(reportDate, timeZone).end
    : undefined;
  const balances = await queryStockBalanceAggregates(cutoff);
  return balances.map(balance => ({
    ...balance,
    logisticsAvailable: centsToDecimal(
      maxZeroCents(
        decimalToCents(balance.logisticsIn) -
          decimalToCents(balance.logisticsOut) -
          decimalToCents(balance.logisticsReject ?? 0)
      )
    ),
    productionAvailable: centsToDecimal(
      maxZeroCents(
        decimalToCents(balance.productionIn) -
          decimalToCents(balance.productionOut) -
          decimalToCents(balance.productionReject ?? 0)
      )
    ),
  }));
}

async function queryStockBalanceAggregates(cutoff?: Date) {
  const db = await getDb();
  if (!db) return [];

  const source = stockSourceExpression();
  const condition = cutoff ? lt(stockTransactions.movedAt, cutoff) : undefined;
  return db
    .select({
      skuName: stockTransactions.skuName,
      step: stockTransactions.step,
      logisticsIn: sql<string>`COALESCE(SUM(CASE WHEN ${stockTransactions.movementType} = 'in' AND ${source} = 'logistics' THEN ${stockTransactions.qty} ELSE 0 END), 0)`,
      productionIn: sql<string>`COALESCE(SUM(CASE WHEN ${stockTransactions.movementType} = 'in' AND ${source} = 'production' THEN ${stockTransactions.qty} ELSE 0 END), 0)`,
      logisticsOut: sql<string>`COALESCE(SUM(CASE WHEN ${stockTransactions.movementType} = 'out' AND ${source} = 'logistics' THEN ${stockTransactions.qty} ELSE 0 END), 0)`,
      productionOut: sql<string>`COALESCE(SUM(CASE WHEN ${stockTransactions.movementType} = 'out' AND ${source} = 'production' THEN ${stockTransactions.qty} ELSE 0 END), 0)`,
      stockOut: sql<string>`COALESCE(SUM(CASE WHEN ${stockTransactions.movementType} = 'out' THEN ${stockTransactions.qty} ELSE 0 END), 0)`,
      rejectQty: sql<string>`COALESCE(SUM(CASE WHEN ${stockTransactions.movementType} = 'reject' THEN ${stockTransactions.qty} ELSE 0 END), 0)`,
      logisticsReject: sql<string>`COALESCE(SUM(CASE WHEN ${stockTransactions.movementType} = 'reject' AND ${source} = 'logistics' THEN ${stockTransactions.qty} ELSE 0 END), 0)`,
      productionReject: sql<string>`COALESCE(SUM(CASE WHEN ${stockTransactions.movementType} = 'reject' AND ${source} = 'production' THEN ${stockTransactions.qty} ELSE 0 END), 0)`,
    })
    .from(stockTransactions)
    .where(condition)
    .groupBy(stockTransactions.skuName, stockTransactions.step);
}

export async function listStockDailyBalances(
  reportDate: string,
  timeZone = BUSINESS_TIME_ZONE
) {
  const db = await getDb();
  if (!db) return [];
  const window = getStockDateWindow(reportDate, timeZone);
  const [openingRows, dailyMovements] = await Promise.all([
    queryStockBalanceAggregates(window.start),
    db
      .select({
        skuName: stockTransactions.skuName,
        step: stockTransactions.step,
        movementType: stockTransactions.movementType,
        qty: stockTransactions.qty,
        reason: stockTransactions.reason,
        stockSource: stockTransactions.stockSource,
      })
      .from(stockTransactions)
      .where(
        and(
          gte(stockTransactions.movedAt, window.start),
          lt(stockTransactions.movedAt, window.end)
        )
      )
      .orderBy(asc(stockTransactions.movedAt), asc(stockTransactions.id)),
  ]);
  return buildStockDailySnapshot(
    openingRows as StockBalanceAggregate[],
    dailyMovements as StockMovement[]
  );
}

export async function listStockInReasonBreakdown(
  reportDate?: string,
  timeZone = BUSINESS_TIME_ZONE
) {
  const db = await getDb();
  if (!db) return [];

  const window = reportDate ? getStockDateWindow(reportDate, timeZone) : undefined;
  const condition = window
    ? and(
        eq(stockTransactions.movementType, "in"),
        gte(stockTransactions.movedAt, window.start),
        lt(stockTransactions.movedAt, window.end)
      )
    : eq(stockTransactions.movementType, "in");

  return db
    .select({
      skuName: stockTransactions.skuName,
      step: stockTransactions.step,
      reason: stockTransactions.reason,
      qty: sql<string>`COALESCE(SUM(${stockTransactions.qty}), 0)`,
    })
    .from(stockTransactions)
    .where(condition)
    .groupBy(
      stockTransactions.skuName,
      stockTransactions.step,
      stockTransactions.reason
    )
    .orderBy(
      asc(stockTransactions.skuName),
      asc(stockTransactions.step),
      asc(stockTransactions.reason)
    );
}

type StockMovementRow = Pick<
  StockTransaction,
  "movementType" | "qty" | "stockSource" | "reason"
>;
const DECIMAL_BASE = BigInt(100);
const ZERO_CENTS = BigInt(0);

function maxZeroCents(value: bigint) {
  return value > ZERO_CENTS ? value : ZERO_CENTS;
}

function decimalToCents(value: string | number) {
  const normalized = String(value);
  const [whole, fraction = ""] = normalized.split(".");
  return (
    BigInt(whole) * DECIMAL_BASE + BigInt(fraction.padEnd(2, "0").slice(0, 2))
  );
}

function centsToDecimal(value: bigint) {
  const whole = value / DECIMAL_BASE;
  const fraction = String(value % DECIMAL_BASE).padStart(2, "0");
  return `${whole}.${fraction}`;
}

function getStockBucketBalances(rows: StockMovementRow[]) {
  const balances: Record<StockSource, bigint> = {
    logistics: ZERO_CENTS,
    production: ZERO_CENTS,
  };
  for (const row of rows) {
    const source = classifyStockSource(row.stockSource, row.reason);
    const qty = decimalToCents(row.qty);
    if (row.movementType === "reject") {
      balances[source] = maxZeroCents(balances[source] - qty);
      continue;
    }
    if (row.movementType === "in") balances[source] += qty;
    if (row.movementType === "out") balances[source] -= qty;
  }
  return balances;
}

export async function createStockTransaction(input: {
  movementType: "in" | "out" | "reject";
  skuName: string;
  step: number;
  qty: string;
  reason: string;
  stockSource?: StockSource | null;
  stockOutSource?: StockOutSelection;
  remark?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia");

  return db.transaction(async tx => {
    let stockSource = input.stockSource ?? null;
    let values: Array<{
      movementType: "in" | "out" | "reject";
      skuName: string;
      step: number;
      qty: string;
      reason: string;
      stockSource: StockSource | null;
      remark: string | null;
    }>;
    if (input.movementType === "in") {
      stockSource = classifyStockSource(stockSource, input.reason);
    }
    if (input.movementType === "out") {
      const existing = await tx
        .select()
        .from(stockTransactions)
        .where(
          and(
            eq(stockTransactions.skuName, input.skuName),
            eq(stockTransactions.step, input.step)
          )
        )
        .orderBy(asc(stockTransactions.movedAt), asc(stockTransactions.id))
        .for("update");
      const balances = getStockBucketBalances(existing);
      const requested = decimalToCents(input.qty);
      const allocations = allocateStockOut(
        requested,
        balances,
        input.stockOutSource ?? "both"
      );
      values = allocations.map(allocation => ({
        movementType: "out",
        skuName: input.skuName,
        step: input.step,
        qty: centsToDecimal(allocation.qty),
        reason: input.reason,
        stockSource: allocation.stockSource,
        remark: input.remark ?? null,
      }));
    } else {
      values = [
        {
          movementType: input.movementType,
          skuName: input.skuName,
          step: input.step,
          qty: input.qty,
          reason: input.reason,
          stockSource,
          remark: input.remark ?? null,
        },
      ];
    }

    const rows = [];
    for (const value of values) {
      const inserted = await tx.insert(stockTransactions).values(value);
      const id = Number(inserted[0].insertId);
      const insertedRows = await tx
        .select()
        .from(stockTransactions)
        .where(eq(stockTransactions.id, id))
        .limit(1);
      if (insertedRows[0]) rows.push(insertedRows[0]);
    }
    if (rows.length === 1) return rows[0];
    return {
      ...rows[0],
      qty: input.qty,
      stockSource: null,
      transactions: rows,
      summary: {
        skuName: input.skuName,
        step: input.step,
        qty: input.qty,
      },
    };
  });
}

export async function transferStock(input: {
  sourceSku: string;
  targetSku: string;
  step: 14 | 15 | 16;
  qty: string;
  reason: "return" | "sisa jual" | "tambahan produksi";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia");

  const transferId = randomUUID();
  return db.transaction(async tx => {
    const sourceRows = await tx
      .select()
      .from(stockTransactions)
      .where(
        and(
          eq(stockTransactions.skuName, input.sourceSku),
          eq(stockTransactions.step, input.step)
        )
      )
      .orderBy(asc(stockTransactions.movedAt), asc(stockTransactions.id))
      .for("update");
    const balances = getStockBucketBalances(sourceRows);
    const requested = decimalToCents(input.qty);
    const available = balances.logistics + balances.production;
    if (available < requested)
      throw new Error("Saldo SKU sumber tidak mencukupi");

    const allocations: Array<{ stockSource: StockSource; qty: bigint }> = [];
    let remaining = requested;
    for (const stockSource of ["logistics", "production"] as const) {
      const bucket =
        balances[stockSource] > ZERO_CENTS ? balances[stockSource] : ZERO_CENTS;
      const qty = bucket > remaining ? remaining : bucket;
      if (qty > ZERO_CENTS) allocations.push({ stockSource, qty });
      remaining -= qty;
      if (remaining === ZERO_CENTS) break;
    }
    if (remaining !== ZERO_CENTS)
      throw new Error("Saldo SKU sumber tidak mencukupi");

    await tx.insert(stockTransactions).values(
      allocations.flatMap(({ stockSource, qty }) => [
        {
          movementType: "out" as const,
          skuName: input.sourceSku,
          step: input.step,
          qty: centsToDecimal(qty),
          reason: "Pindah SKU",
          stockSource,
          remark: null,
          transferId,
          relatedSku: input.targetSku,
        },
        {
          movementType: "in" as const,
          skuName: input.targetSku,
          step: input.step,
          qty: centsToDecimal(qty),
          reason: input.reason,
          stockSource,
          remark: null,
          transferId,
          relatedSku: input.sourceSku,
        },
      ])
    );

    const transactions = await tx
      .select()
      .from(stockTransactions)
      .where(eq(stockTransactions.transferId, transferId))
      .orderBy(asc(stockTransactions.id));
    return {
      transferId,
      transactions,
      summary: {
        sourceSku: input.sourceSku,
        targetSku: input.targetSku,
        step: input.step,
        qty: input.qty,
        allocations: allocations.map(allocation => ({
          stockSource: allocation.stockSource,
          qty: centsToDecimal(allocation.qty),
        })),
      },
    };
  });
}
