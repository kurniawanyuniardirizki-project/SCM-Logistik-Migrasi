import { describe, expect, it } from "vitest";
import { allocateStockOut } from "./stock-allocation";

const cents = (value: number) => BigInt(Math.round(value * 100));
const qty = (value: bigint) => Number(value) / 100;

describe("allocateStockOut", () => {
  it("mengambil dari logistik saja saat dipilih", () => {
    const rows = allocateStockOut(
      cents(3),
      { logistics: cents(5), production: cents(8) },
      "logistics"
    );
    expect(rows.map(row => [row.stockSource, qty(row.qty)])).toEqual([
      ["logistics", 3],
    ]);
  });

  it("mengambil dari produksi saja saat dipilih", () => {
    const rows = allocateStockOut(
      cents(2.5),
      { logistics: cents(5), production: cents(4) },
      "production"
    );
    expect(rows.map(row => [row.stockSource, qty(row.qty)])).toEqual([
      ["production", 2.5],
    ]);
  });

  it("menggunakan logistik lalu produksi untuk pilihan gabungan", () => {
    const rows = allocateStockOut(
      cents(7),
      { logistics: cents(4), production: cents(5) },
      "both"
    );
    expect(rows.map(row => [row.stockSource, qty(row.qty)])).toEqual([
      ["logistics", 4],
      ["production", 3],
    ]);
  });

  it("menolak saldo yang kurang di sumber tunggal", () => {
    expect(() =>
      allocateStockOut(
        cents(6),
        { logistics: cents(5), production: cents(8) },
        "logistics"
      )
    ).toThrow("Saldo stock logistik tidak mencukupi");
  });

  it("menolak saldo gabungan yang kurang tanpa alokasi parsial", () => {
    expect(() =>
      allocateStockOut(
        cents(9),
        { logistics: cents(4), production: cents(4) },
        "both"
      )
    ).toThrow("Saldo stock logistik dan produksi tidak mencukupi");
  });
});
