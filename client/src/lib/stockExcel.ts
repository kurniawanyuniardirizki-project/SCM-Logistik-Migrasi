export type StockHistoryExportRow = {
  id: string | number;
  movedAt?: Date | string | number | null;
  movementType?: string | null;
  skuName?: string | null;
  relatedSku?: string | null;
  step?: number | string | null;
  qty?: number | string | null;
  reason?: string | null;
  stockSource?: string | null;
  remark?: string | null;
  transferId?: string | null;
};

const EXPORT_COLUMNS = [
  { header: "ID", key: "id", width: 16 },
  { header: "Waktu", key: "movedAt", width: 23 },
  { header: "Jenis", key: "movementType", width: 14 },
  { header: "SKU", key: "skuName", width: 34 },
  { header: "SKU terkait", key: "relatedSku", width: 34 },
  { header: "Step", key: "step", width: 10 },
  { header: "Qty", key: "qty", width: 14 },
  { header: "Reason", key: "reason", width: 20 },
  { header: "Stock source", key: "stockSource", width: 18 },
  { header: "Remark", key: "remark", width: 34 },
  { header: "Transfer ID", key: "transferId", width: 24 },
] as const;

function safeText(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function asNumber(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function formatJakartaDateTime(value: StockHistoryExportRow["movedAt"]) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(",", "");
}

function movementLabel(value: unknown) {
  if (value === "in") return "Stock In";
  if (value === "out") return "Stock Out";
  if (value === "reject") return "Reject";
  return safeText(value);
}

export async function downloadStockHistoryXlsx(
  rows: StockHistoryExportRow[],
  fromDate: string,
  toDate: string
) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sunpride SCM";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Riwayat Transaksi", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [...EXPORT_COLUMNS];
  sheet.autoFilter = {
    from: "A1",
    to: `${String.fromCharCode(64 + EXPORT_COLUMNS.length)}1`,
  };

  const header = sheet.getRow(1);
  header.height = 24;
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF28563A" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  rows.forEach(row => {
    const excelRow = sheet.addRow({
      id: safeText(row.id),
      movedAt: formatJakartaDateTime(row.movedAt),
      movementType: movementLabel(row.movementType),
      skuName: safeText(row.skuName),
      relatedSku: safeText(row.relatedSku),
      step: row.step == null ? "" : asNumber(row.step),
      qty: row.qty == null ? "" : asNumber(row.qty),
      reason: safeText(row.reason),
      stockSource: safeText(row.stockSource),
      remark: safeText(row.remark),
      transferId: safeText(row.transferId),
    });
    excelRow.getCell("qty").numFmt = "#,##0.00";
    excelRow.getCell("step").alignment = { horizontal: "center" };
    excelRow.getCell("qty").alignment = { horizontal: "right" };
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell(cell => {
        cell.border = {
          bottom: { style: "hair", color: { argb: "FFE1E8E1" } },
        };
        cell.alignment = { vertical: "middle", wrapText: true };
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `riwayat-transaksi-${fromDate}-sampai-${toDate}.xlsx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
