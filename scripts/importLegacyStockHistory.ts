import { readFile } from "node:fs/promises";
import { inArray } from "drizzle-orm";
import { InsertStockTransaction, stockTransactions } from "../drizzle/schema";
import { getDb } from "../server/db";

type LegacyRow = {
  id: number;
  movedAt: string;
  movementType: "in" | "out" | "reject";
  qty: string;
  reason: string;
  remark: string | null;
  skuName: string;
  step: number;
  stockSource: string | null;
};

type ImportRow = Omit<InsertStockTransaction, "id" | "movedAt"> & {
  id: number;
  movedAt: Date;
  transferId: null;
  relatedSku: null;
};

function normalizeQty(value: string | number) {
  const [whole, fraction = ""] = String(value).split(".");
  return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

function normalizeDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Waktu tidak valid: ${value}`);
  date.setUTCMilliseconds(0);
  return date.toISOString();
}

function validateRows(raw: unknown): ImportRow[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Snapshot harus berupa array transaksi yang tidak kosong");
  }
  const seen = new Set<number>();
  return raw.map((entry, index) => {
    const row = entry as LegacyRow;
    if (!Number.isSafeInteger(row.id) || row.id <= 0) {
      throw new Error(`ID transaksi tidak valid pada baris ${index + 1}`);
    }
    if (seen.has(row.id)) throw new Error(`ID sumber duplikat: ${row.id}`);
    seen.add(row.id);
    if (!row.skuName || row.skuName.length > 255) {
      throw new Error(`SKU tidak valid pada ID ${row.id}`);
    }
    if (![14, 15, 16].includes(row.step)) {
      throw new Error(`Step tidak valid pada ID ${row.id}`);
    }
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(String(row.qty)) || Number(row.qty) <= 0) {
      throw new Error(`Qty tidak valid pada ID ${row.id}`);
    }
    if (!row.reason || row.reason.length > 64) {
      throw new Error(`Reason tidak valid pada ID ${row.id}`);
    }
    if (row.movementType !== "in" && row.movementType !== "out" && row.movementType !== "reject") {
      throw new Error(`Tipe transaksi tidak valid pada ID ${row.id}`);
    }
    const source = row.stockSource ?? null;
    if (source !== null && (typeof source !== "string" || source.length > 32)) {
      throw new Error(`stockSource tidak valid pada ID ${row.id}`);
    }
    const movedAt = new Date(row.movedAt);
    if (!Number.isFinite(movedAt.getTime())) {
      throw new Error(`movedAt tidak valid pada ID ${row.id}`);
    }
    return {
      id: row.id,
      movedAt,
      movementType: row.movementType,
      skuName: row.skuName,
      step: row.step,
      qty: normalizeQty(row.qty),
      reason: row.reason,
      stockSource: source,
      remark: row.remark ?? null,
      transferId: null,
      relatedSku: null,
    };
  });
}

function sameValue(existing: Record<string, unknown>, expected: ImportRow) {
  return (
    Number(existing.id) === expected.id &&
    existing.movementType === expected.movementType &&
    existing.skuName === expected.skuName &&
    Number(existing.step) === expected.step &&
    normalizeQty(existing.qty as string | number) === normalizeQty(expected.qty as string | number) &&
    existing.reason === expected.reason &&
    normalizeDate(existing.movedAt as string | Date) === normalizeDate(expected.movedAt) &&
    (existing.stockSource ?? null) === (expected.stockSource ?? null) &&
    (existing.remark ?? null) === (expected.remark ?? null) &&
    (existing.transferId ?? null) === null &&
    (existing.relatedSku ?? null) === null
  );
}

function totalFor(rows: ImportRow[], movementType: "in" | "out") {
  return rows
    .filter(row => row.movementType === movementType)
    .reduce((sum, row) => sum + BigInt(normalizeQty(row.qty).replace(".", "")), BigInt(0));
}

function formatCents(value: bigint) {
  const base = BigInt(100);
  return `${value / base}.${String(value % base).padStart(2, "0")}`;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const snapshotPath = args.find((value: string) => !value.startsWith("--"));
  if (!snapshotPath) {
    throw new Error("Cara pakai: pnpm exec tsx scripts/importLegacyStockHistory.ts [--apply] <snapshot.json>");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL tidak tersedia pada environment project");

  const raw = JSON.parse(await readFile(snapshotPath, "utf8")) as unknown;
  const rows = validateRows(raw);
  const db = await getDb();
  if (!db) throw new Error("Database terkelola tidak tersedia");

  try {
    const result = await db.transaction(async tx => {
      const existing = await tx
        .select()
        .from(stockTransactions)
        .where(inArray(stockTransactions.id, rows.map(row => row.id)));
      const existingById = new Map(existing.map(row => [row.id, row]));
      const conflicts = rows.filter(row => {
        const current = existingById.get(row.id);
        return current !== undefined && !sameValue(current as unknown as Record<string, unknown>, row);
      });
      if (conflicts.length > 0) {
        throw new Error(`Ditemukan ${conflicts.length} ID yang sudah dipakai dengan isi berbeda; tidak ada baris yang ditulis`);
      }
      const missing = rows.filter(row => !existingById.has(row.id));
      if (apply) {
        for (let offset = 0; offset < missing.length; offset += 100) {
          await tx.insert(stockTransactions).values(missing.slice(offset, offset + 100));
        }
      }
      return { inserted: apply ? missing.length : 0, alreadyPresent: existing.length, readyToInsert: missing.length };
    });

    const verified = await db
      .select()
      .from(stockTransactions)
      .where(inArray(stockTransactions.id, rows.map(row => row.id)));
    const verifiedById = new Map(verified.map(row => [row.id, row]));
    const invalid = rows.filter(row => {
      const current = verifiedById.get(row.id);
      return current === undefined || !sameValue(current as unknown as Record<string, unknown>, row);
    });
    if (apply && invalid.length > 0) throw new Error(`Verifikasi gagal pada ${invalid.length} transaksi setelah impor`);

    console.log(JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      sourceRows: rows.length,
      sourceIdsUnique: new Set(rows.map(row => row.id)).size,
      ...result,
      verifiedRows: apply ? verified.length : undefined,
      totalIn: formatCents(totalFor(rows, "in")),
      totalOut: formatCents(totalFor(rows, "out")),
    }, null, 2));
  } finally {
    const client = (db as unknown as { $client?: { end?: () => Promise<void> } }).$client;
    if (client?.end) await client.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
