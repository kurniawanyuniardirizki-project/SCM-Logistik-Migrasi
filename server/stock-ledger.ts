export type StockSource = "logistics" | "production";
export type StockMovementType = "in" | "out" | "reject";

export function classifyStockSource(
  stockSource: string | null | undefined,
  reason: string
): StockSource {
  const explicit = stockSource?.trim().toLowerCase();
  if (explicit === "production" || explicit === "logistics") return explicit;

  const normalizedReason = reason.trim().toLowerCase();
  if (
    normalizedReason.includes("produksi") ||
    normalizedReason.includes("konversi") ||
    normalizedReason.includes("lompat step")
  ) {
    return "production";
  }
  return "logistics";
}

export type StockBalanceAggregate = {
  skuName: string;
  step: number;
  logisticsIn: string | number;
  productionIn: string | number;
  logisticsOut: string | number;
  productionOut: string | number;
  rejectQty: string | number;
  logisticsReject?: string | number;
  productionReject?: string | number;
};

export type StockMovement = {
  skuName: string;
  step: number;
  movementType: StockMovementType;
  qty: string | number;
  reason: string;
  stockSource?: string | null;
};

export type StockDailyBalance = {
  skuName: string;
  step: number;
  openingLogistics: string;
  openingProduction: string;
  openingStock: string;
  logisticsIn: string;
  productionIn: string;
  logisticsOut: string;
  productionOut: string;
  stockOut: string;
  rejectQty: string;
  closingLogistics: string;
  closingProduction: string;
  closingStock: string;
  logisticsAvailable: string;
  productionAvailable: string;
};

const DECIMAL_BASE = BigInt(100);
const ZERO = BigInt(0);

function toCents(value: string | number | null | undefined) {
  const normalized = String(value ?? 0);
  const [whole, fraction = ""] = normalized.split(".");
  return (
    BigInt(whole) * DECIMAL_BASE + BigInt(fraction.padEnd(2, "0").slice(0, 2))
  );
}

function fromCents(value: bigint) {
  return `${value / DECIMAL_BASE}.${String(value % DECIMAL_BASE).padStart(2, "0")}`;
}

function maxZero(value: bigint) {
  return value > ZERO ? value : ZERO;
}

function keyOf(row: Pick<StockMovement, "skuName" | "step">) {
  return `${row.skuName}\u0000${row.step}`;
}

function createBucket() {
  return {
    logisticsIn: ZERO,
    productionIn: ZERO,
    logisticsOut: ZERO,
    productionOut: ZERO,
    logisticsReject: ZERO,
    productionReject: ZERO,
  };
}

function openingFromAggregate(row: StockBalanceAggregate) {
  return {
    logistics: maxZero(
      toCents(row.logisticsIn) -
        toCents(row.logisticsOut) -
        toCents(row.logisticsReject ?? row.rejectQty ?? 0)
    ),
    production: maxZero(
      toCents(row.productionIn) -
        toCents(row.productionOut) -
        toCents(row.productionReject ?? 0)
    ),
  };
}

export function buildStockDailySnapshot(
  openingRows: StockBalanceAggregate[],
  dailyMovements: StockMovement[]
): StockDailyBalance[] {
  const openings = new Map<string, { skuName: string; step: number; logistics: bigint; production: bigint }>();
  const movements = new Map<
    string,
    ReturnType<typeof createBucket> & { skuName: string; step: number }
  >();

  for (const row of openingRows) {
    const opening = openingFromAggregate(row);
    openings.set(keyOf(row), {
      skuName: row.skuName,
      step: row.step,
      ...opening,
    });
  }

  for (const row of dailyMovements) {
    const key = keyOf(row);
    const current = movements.get(key) ?? {
      skuName: row.skuName,
      step: row.step,
      ...createBucket(),
    };
    const qty = toCents(row.qty);
    const source = classifyStockSource(row.stockSource, row.reason);
    if (row.movementType === "in" && source === "logistics")
      current.logisticsIn += qty;
    if (row.movementType === "in" && source === "production")
      current.productionIn += qty;
    if (row.movementType === "out" && source === "logistics")
      current.logisticsOut += qty;
    if (row.movementType === "out" && source === "production")
      current.productionOut += qty;
    if (row.movementType === "reject" && source === "logistics")
      current.logisticsReject += qty;
    if (row.movementType === "reject" && source === "production")
      current.productionReject += qty;
    movements.set(key, current);
  }

  const keys = Array.from(
    new Set(
      Array.from(openings.keys()).concat(Array.from(movements.keys()))
    )
  );
  return keys
    .map(key => {
      const opening = openings.get(key);
      const movement = movements.get(key);
      const openingLogistics = opening?.logistics ?? ZERO;
      const openingProduction = opening?.production ?? ZERO;
      const daily = movement ?? {
        skuName: opening?.skuName ?? "",
        step: opening?.step ?? 0,
        ...createBucket(),
      };
      const closingLogistics = maxZero(
        openingLogistics + daily.logisticsIn - daily.logisticsOut - daily.logisticsReject
      );
      const closingProduction = maxZero(
        openingProduction + daily.productionIn - daily.productionOut - daily.productionReject
      );
      const stockOut = daily.logisticsOut + daily.productionOut;
      const rejectQty = daily.logisticsReject + daily.productionReject;
      const closingStock = closingLogistics + closingProduction;
      const openingStock = openingLogistics + openingProduction;
      return {
        skuName: daily.skuName,
        step: daily.step,
        openingLogistics: fromCents(openingLogistics),
        openingProduction: fromCents(openingProduction),
        openingStock: fromCents(openingStock),
        logisticsIn: fromCents(daily.logisticsIn),
        productionIn: fromCents(daily.productionIn),
        logisticsOut: fromCents(daily.logisticsOut),
        productionOut: fromCents(daily.productionOut),
        stockOut: fromCents(stockOut),
        rejectQty: fromCents(rejectQty),
        closingLogistics: fromCents(closingLogistics),
        closingProduction: fromCents(closingProduction),
        closingStock: fromCents(closingStock),
        logisticsAvailable: fromCents(closingLogistics),
        productionAvailable: fromCents(closingProduction),
      };
    })
    .sort(
      (left, right) =>
        left.skuName.localeCompare(right.skuName, "id") || left.step - right.step
    );
}
