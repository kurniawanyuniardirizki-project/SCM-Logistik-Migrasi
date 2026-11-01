import { describe, expect, it } from "vitest";
import { addComputedValues, calculateStockBalanceSummary, calculateStockSummary } from "./routers";

describe("banana report calculations", () => {
  it("sums logistics and Tambahan ST Pro into total", () => {
    const result = addComputedValues({
      logistics14: "10.00",
      logistics15: "5",
      logistics16: "0",
      additional14: "3",
      additional15: "2.5",
      additional16: "0",
      rejectQty: "1",
    });

    expect(result.total).toBe(20.5);
    expect(result.sisa).toBe(19.5);
  });

  it("keeps negative remaining visible when reject exceeds total", () => {
    const result = addComputedValues({
      logistics14: "2",
      logistics15: "0",
      logistics16: "0",
      additional14: "0",
      additional15: "0",
      additional16: "0",
      rejectQty: "3",
    });

    expect(result.total).toBe(2);
    expect(result.sisa).toBe(-1);
  });
});

describe("stock summary", () => {
  it("calculates step balances from stock in and out", () => {
    const result = calculateStockSummary([
      { movementType: "in", step: 14, qty: "10" },
      { movementType: "out", step: 14, qty: "3" },
      { movementType: "in", step: 15, qty: "4.5" },
      { movementType: "out", step: 16, qty: "2" },
      { movementType: "reject", step: 16, qty: "1.25" },
    ]);

    expect(result.step14).toBe(7);
    expect(result.step15).toBe(4.5);
    expect(result.step16).toBe(-2);
    expect(result.reject).toBe(1.25);
    expect(result.totalIn).toBe(14.5);
    expect(result.totalOut).toBe(5);
  });

  it("calculates overall stock balances after stock out", () => {
    const result = calculateStockBalanceSummary([
      { step: 14, logisticsIn: "10", productionIn: "4", stockOut: "3", rejectQty: "1" },
      { step: 15, logisticsIn: "2.5", productionIn: "5", stockOut: "1.5", rejectQty: "0" },
    ]);

    expect(result.step14).toBe(10);
    expect(result.step15).toBe(6);
    expect(result.totalIn).toBe(21.5);
    expect(result.totalOut).toBe(4.5);
    expect(result.reject).toBe(1);
  });

  it("uses closing snapshot when opening stock and today's movements are combined", () => {
    const result = calculateStockBalanceSummary([
      {
        step: 14,
        logisticsIn: "1",
        productionIn: "2",
        stockOut: "3",
        rejectQty: "0.5",
        closingStock: "4.5",
      },
    ]);

    expect(result.step14).toBe(4.5);
    expect(result.totalIn).toBe(3);
    expect(result.totalOut).toBe(3);
    expect(result.reject).toBe(0.5);
  });
});
