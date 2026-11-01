import { BUSINESS_TIME_ZONE, COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createStockTransaction,
  deleteBananaReport,
  getBananaReportByDate,
  listBananaReports,
  listStockBalances,
  listStockDailyBalances,
  listStockInReasonBreakdown,
  listStockTransactionHistory,
  listStockTransactions,
  saveBananaReport,
  transferStock,
} from "./db";

const decimalInput = z
  .string()
  .trim()
  .regex(
    /^\d{1,8}(\.\d{1,2})?$/,
    "Nilai harus berupa angka positif maksimal 2 desimal"
  );
const positiveDecimalInput = decimalInput.refine(
  value => Number(value) > 0,
  "Nilai harus lebih besar dari 0"
);
const reportDateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus dalam format YYYY-MM-DD")
  .refine(value => {
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= daysInMonth[month - 1];
  }, "Tanggal kalender tidak valid");
const timeZoneInput = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .default(BUSINESS_TIME_ZONE)
  .refine(value => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Zona waktu tidak valid");
const stepInput = z.union([z.literal(14), z.literal(15), z.literal(16)]);
const stockOutSourceInput = z.enum(["logistics", "production", "both"]);

const reportItemInput = z.object({
  skuOrder: z.number().int().min(1).max(100),
  skuName: z.string().trim().min(1).max(255),
  logistics14: decimalInput,
  logistics15: decimalInput,
  logistics16: decimalInput,
  additional14: decimalInput,
  additional15: decimalInput,
  additional16: decimalInput,
  doQty: decimalInput,
  remark: z.string().trim().max(500).nullable().optional(),
  rejectQty: decimalInput,
});

function asNumber(value: string | number | null | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export function addComputedValues<T extends Record<string, unknown>>(item: T) {
  const total =
    asNumber(item.logistics14 as string) +
    asNumber(item.logistics15 as string) +
    asNumber(item.logistics16 as string) +
    asNumber(item.additional14 as string) +
    asNumber(item.additional15 as string) +
    asNumber(item.additional16 as string);
  const sisa =
    total - asNumber(item.doQty as string) - asNumber(item.rejectQty as string);
  return { ...item, total, sisa };
}

type StockSummaryRow = {
  movementType: "in" | "out" | "reject";
  step: number;
  qty: string | number;
};

export function calculateStockSummary(transactions: StockSummaryRow[]) {
  const summary = {
    step14: 0,
    step15: 0,
    step16: 0,
    reject: 0,
    totalIn: 0,
    totalOut: 0,
  };

  for (const transaction of transactions) {
    const qty = asNumber(transaction.qty);
    if (transaction.movementType === "reject") {
      summary.reject += qty;
      continue;
    }
    if (transaction.movementType === "in") summary.totalIn += qty;
    if (transaction.movementType === "out") summary.totalOut += qty;
    const direction = transaction.movementType === "in" ? 1 : -1;
    if (transaction.step === 14) summary.step14 += direction * qty;
    if (transaction.step === 15) summary.step15 += direction * qty;
    if (transaction.step === 16) summary.step16 += direction * qty;
  }

  return summary;
}

type StockBalanceRow = {
  step: number;
  logisticsIn: string | number;
  productionIn: string | number;
  stockOut: string | number;
  rejectQty: string | number;
  closingStock?: string | number;
};

export function calculateStockBalanceSummary(balances: StockBalanceRow[]) {
  const summary = {
    step14: 0,
    step15: 0,
    step16: 0,
    reject: 0,
    totalIn: 0,
    totalOut: 0,
  };

  for (const balance of balances) {
    const incoming =
      asNumber(balance.logisticsIn) + asNumber(balance.productionIn);
    const outgoing = asNumber(balance.stockOut);
    const rejected = asNumber(balance.rejectQty);
    summary.totalIn += incoming;
    summary.totalOut += outgoing;
    summary.reject += rejected;
    const net =
      balance.closingStock === undefined
        ? incoming - outgoing - rejected
        : asNumber(balance.closingStock);
    if (balance.step === 14) summary.step14 += net;
    if (balance.step === 15) summary.step15 += net;
    if (balance.step === 16) summary.step16 += net;
  }

  return summary;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  report: router({
    getByDate: adminProcedure
      .input(z.object({ reportDate: reportDateInput }))
      .query(async ({ input }) => {
        const report = await getBananaReportByDate(input.reportDate);
        if (!report) return null;
        return {
          ...report,
          items: report.items.map(item => addComputedValues(item)),
        };
      }),

    list: adminProcedure.query(async () => {
      const reports = await listBananaReports();
      return reports.map(report => ({
        ...report,
        label: new Date(
          `${report.reportDate}T12:00:00.000Z`
        ).toLocaleDateString("id-ID", {
          timeZone: BUSINESS_TIME_ZONE,
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      }));
    }),

    save: adminProcedure
      .input(
        z.object({
          reportDate: reportDateInput,
          items: z.array(reportItemInput).min(1).max(100),
        })
      )
      .mutation(async ({ input }) => {
        const report = await saveBananaReport(input);
        if (!report) return null;
        return {
          ...report,
          items: report.items.map(item => addComputedValues(item)),
        };
      }),

    delete: adminProcedure
      .input(z.object({ reportDate: reportDateInput }))
      .mutation(async ({ input }) => deleteBananaReport(input.reportDate)),
  }),

  stock: router({
    outAvailability: publicProcedure.query(async () => listStockBalances()),

    salesDisplay: publicProcedure
      .input(
        z.object({
          reportDate: reportDateInput,
          timeZone: timeZoneInput,
        })
      )
      .query(async ({ input }) => {
        const [balances, stockInReasons] = await Promise.all([
          listStockDailyBalances(input.reportDate, input.timeZone),
          listStockInReasonBreakdown(input.reportDate, input.timeZone),
        ]);
        return { balances, stockInReasons };
      }),

    list: adminProcedure
      .input(
        z.object({
          reportDate: reportDateInput.optional(),
          timeZone: timeZoneInput,
        })
      )
      .query(async ({ input }) => {
        const transactions = await listStockTransactions(
          input.reportDate,
          input.timeZone
        );
        const balances = input.reportDate
          ? await listStockDailyBalances(input.reportDate, input.timeZone)
          : await listStockBalances();
        return {
          transactions,
          balances,
          summary: calculateStockBalanceSummary(balances),
        };
      }),

    history: adminProcedure
      .input(
        z
          .object({
            fromDate: reportDateInput,
            toDate: reportDateInput,
            timeZone: timeZoneInput,
          })
          .refine(input => input.fromDate <= input.toDate, {
            message: "Rentang tanggal tidak valid",
            path: ["toDate"],
          })
      )
      .query(async ({ input }) =>
        listStockTransactionHistory(
          input.fromDate,
          input.toDate,
          input.timeZone
        )
      ),

    transfer: adminProcedure
      .input(
        z
          .object({
            sourceSku: z.string().trim().min(1).max(255),
            targetSku: z.string().trim().min(1).max(255),
            step: stepInput,
            qty: positiveDecimalInput,
            reason: z.enum(["return", "sisa jual", "tambahan produksi"]),
          })
          .refine(
            input =>
              input.sourceSku.toLowerCase() !== input.targetSku.toLowerCase(),
            {
              message: "SKU sumber dan tujuan harus berbeda",
              path: ["targetSku"],
            }
          )
      )
      .mutation(async ({ input }) => transferStock(input)),

    post: adminProcedure
      .input(
        z.object({
          movementType: z.enum(["in", "out", "reject"]),
          skuName: z.string().trim().min(1).max(255),
          step: stepInput,
          qty: positiveDecimalInput,
          reason: z.string().trim().min(1).max(64),
          stockOutSource: stockOutSourceInput.optional(),
        })
      )
      .mutation(async ({ input }) => createStockTransaction(input)),
  }),
});

export type AppRouter = typeof appRouter;
