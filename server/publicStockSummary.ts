import {
  getBananaReportByDate,
  listBananaReports,
  listStockBalances,
} from "./db";

export type PublicStockSummaryItem = {
  sku: string;
  qty: number;
  status: "Tersedia" | "Habis" | "Perlu cek";
  remark: string;
};

export type PublicStockSummary = {
  totalAvailable: number;
  step14: number;
  step15: number;
  step16: number;
  items: PublicStockSummaryItem[];
  updatedAt: string | null;
};

function asNumber(value: string | number | null | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export function filterActiveStockItems(
  items: PublicStockSummaryItem[]
): PublicStockSummaryItem[] {
  return items.filter(item => item.qty > 0);
}

/**
 * Read-only contract consumed by SCM East Sales Display.
 * It intentionally exposes only the current SKU balance and a short remark;
 * report and stock mutations are also public in this no-login deployment.
 */
export async function getPublicStockSummary(): Promise<PublicStockSummary> {
  const [balances, reports] = await Promise.all([
    listStockBalances(),
    listBananaReports(),
  ]);
  const latestReport = reports[0]
    ? await getBananaReportByDate(reports[0].reportDate)
    : undefined;
  const remarks = new Map(
    (latestReport?.items ?? []).map(item => [item.skuName, item.remark ?? ""])
  );

  const bySku = new Map<
    string,
    { step14: number; step15: number; step16: number }
  >();
  for (const balance of balances) {
    const current = bySku.get(balance.skuName) ?? {
      step14: 0,
      step15: 0,
      step16: 0,
    };
    const incoming =
      asNumber(balance.logisticsIn) + asNumber(balance.productionIn);
    const net =
      incoming - asNumber(balance.stockOut) - asNumber(balance.rejectQty);
    if (balance.step === 14) current.step14 += net;
    if (balance.step === 15) current.step15 += net;
    if (balance.step === 16) current.step16 += net;
    bySku.set(balance.skuName, current);
  }

  const items = filterActiveStockItems(
    Array.from(bySku.entries()).map(([sku, values]) => {
      const qty = values.step14 + values.step15 + values.step16;
      const status: PublicStockSummaryItem["status"] =
        qty < 0 ? "Perlu cek" : qty > 0 ? "Tersedia" : "Habis";
      return {
        sku,
        qty: Math.max(0, qty),
        status,
        remark: remarks.get(sku) ?? "",
      };
    })
  ).sort((a, b) => a.sku.localeCompare(b.sku, "id"));

  const step14 = Array.from(bySku.values()).reduce(
    (sum, value) => sum + Math.max(0, value.step14),
    0
  );
  const step15 = Array.from(bySku.values()).reduce(
    (sum, value) => sum + Math.max(0, value.step15),
    0
  );
  const step16 = Array.from(bySku.values()).reduce(
    (sum, value) => sum + Math.max(0, value.step16),
    0
  );

  return {
    totalAvailable: step14 + step15 + step16,
    step14,
    step15,
    step16,
    items,
    updatedAt: latestReport?.updatedAt?.toISOString() ?? null,
  };
}
