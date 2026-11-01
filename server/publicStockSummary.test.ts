import { describe, expect, it } from "vitest";
import {
  filterActiveStockItems,
  type PublicStockSummaryItem,
} from "./publicStockSummary";

describe("filterActiveStockItems", () => {
  it("keeps positive stock and hides zero or depleted SKUs", () => {
    const available: PublicStockSummaryItem = {
      sku: "Sunpride Cavendish",
      qty: 12,
      status: "Tersedia",
      remark: "",
    };
    const items: PublicStockSummaryItem[] = [
      available,
      { sku: "Habis", qty: 0, status: "Habis", remark: "" },
      { sku: "Perlu cek", qty: -2, status: "Perlu cek", remark: "" },
    ];

    expect(filterActiveStockItems(items)).toEqual([available]);
  });
});
