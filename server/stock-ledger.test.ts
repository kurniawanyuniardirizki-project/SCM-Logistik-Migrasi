import { describe, expect, it } from "vitest";
import { buildStockDailySnapshot } from "./stock-ledger";

describe("buildStockDailySnapshot", () => {
  it("membawa hanya saldo tersisa dan menampilkan arus tanggal terpilih", () => {
    const [balance] = buildStockDailySnapshot(
      [
        {
          skuName: "SKU Pisang",
          step: 14,
          logisticsIn: "10.00",
          productionIn: "5.00",
          logisticsOut: "6.00",
          productionOut: "2.00",
          rejectQty: "2.00",
          logisticsReject: "2.00",
          productionReject: "0.00",
        },
      ],
      [
        {
          skuName: "SKU Pisang",
          step: 14,
          movementType: "in",
          qty: "1.00",
          reason: "return",
        },
        {
          skuName: "SKU Pisang",
          step: 14,
          movementType: "in",
          qty: "2.00",
          reason: "stock produksi",
        },
        {
          skuName: "SKU Pisang",
          step: 14,
          movementType: "out",
          qty: "2.00",
          reason: "pengiriman",
          stockSource: "logistics",
        },
        {
          skuName: "SKU Pisang",
          step: 14,
          movementType: "out",
          qty: "1.00",
          reason: "pengiriman",
          stockSource: "production",
        },
        {
          skuName: "SKU Pisang",
          step: 14,
          movementType: "reject",
          qty: "0.50",
          reason: "reject",
          stockSource: "logistics",
        },
      ]
    );

    expect(balance).toMatchObject({
      openingLogistics: "2.00",
      openingProduction: "3.00",
      openingStock: "5.00",
      logisticsIn: "1.00",
      productionIn: "2.00",
      logisticsOut: "2.00",
      productionOut: "1.00",
      stockOut: "3.00",
      rejectQty: "0.50",
      closingLogistics: "0.50",
      closingProduction: "4.00",
      closingStock: "4.50",
    });
  });

  it("mengembalikan nol, bukan histori input lama, setelah saldo habis", () => {
    const [balance] = buildStockDailySnapshot(
      [
        {
          skuName: "SKU Kosong",
          step: 15,
          logisticsIn: "4.00",
          productionIn: "2.00",
          logisticsOut: "4.00",
          productionOut: "2.00",
          rejectQty: "0.00",
        },
      ],
      []
    );

    expect(balance).toMatchObject({
      openingStock: "0.00",
      logisticsIn: "0.00",
      productionIn: "0.00",
      stockOut: "0.00",
      closingStock: "0.00",
    });
  });
});
