import type { StockSource } from "./stock-ledger";

export type StockOutSelection = StockSource | "both";

export type StockAllocation = {
  stockSource: StockSource;
  qty: bigint;
};

export function allocateStockOut(
  requested: bigint,
  balances: Record<StockSource, bigint>,
  selection: StockOutSelection
): StockAllocation[] {
  const zero = BigInt(0);
  if (requested <= zero) {
    throw new Error("Qty stock out harus lebih besar dari 0");
  }

  const sourceOrder: StockSource[] =
    selection === "both" ? ["logistics", "production"] : [selection];
  const available = sourceOrder.reduce(
    (sum, source) => sum + (balances[source] > zero ? balances[source] : zero),
    zero
  );

  if (available < requested) {
    if (selection === "both") {
      throw new Error("Saldo stock logistik dan produksi tidak mencukupi");
    }
    const label = selection === "logistics" ? "logistik" : "produksi";
    throw new Error(`Saldo stock ${label} tidak mencukupi`);
  }

  let remaining = requested;
  const allocations: StockAllocation[] = [];
  for (const stockSource of sourceOrder) {
    const sourceBalance =
      balances[stockSource] > zero ? balances[stockSource] : zero;
    const qty = sourceBalance > remaining ? remaining : sourceBalance;
    if (qty > zero) allocations.push({ stockSource, qty });
    remaining -= qty;
    if (remaining === zero) break;
  }

  if (remaining !== zero) {
    throw new Error("Saldo stock tidak mencukupi");
  }
  return allocations;
}
