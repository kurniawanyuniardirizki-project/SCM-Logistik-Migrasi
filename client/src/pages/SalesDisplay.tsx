import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { BUSINESS_TIME_ZONE } from "@shared/const";
import { getBusinessDateInput } from "@/lib/businessDate";

type CardKey = "allIn" | "step14" | "step15" | "step16" | "remaining";
type DetailRow = {
  skuName: string;
  step: number;
  qty: number;
  reason: string;
};

type StockBalance = {
  skuName: string;
  step: number;
  openingStock: string | number;
  logisticsIn: string | number;
  productionIn: string | number;
  logisticsOut: string | number;
  productionOut: string | number;
  stockOut: string | number;
  rejectQty: string | number;
  closingStock: string | number;
};

type StockInReason = {
  skuName: string;
  step: number;
  reason: string;
  qty: string | number;
};

function numberValue(value: string | number | null | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function displayNumber(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(
    value
  );
}

function displayDate(date: string) {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString("id-ID", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function stepLabel(step: number) {
  return step === 14 ? "1.4" : step === 15 ? "1.5" : step === 16 ? "1.6" : String(step);
}

function stockKey(skuName: string, step: number) {
  return `${skuName}|${step}`;
}

function dailyIn(balance: StockBalance) {
  return numberValue(balance.logisticsIn) + numberValue(balance.productionIn);
}

function opening(balance: StockBalance) {
  return numberValue(balance.openingStock);
}

function closing(balance: StockBalance) {
  return numberValue(balance.closingStock);
}

export default function SalesDisplay() {
  const [reportDate, setReportDate] = useState(getBusinessDateInput);
  const [selectedCard, setSelectedCard] = useState<CardKey | null>(null);
  const timeZone = BUSINESS_TIME_ZONE;
  const salesQuery = trpc.stock.salesDisplay.useQuery(
    { reportDate, timeZone },
    { enabled: Boolean(reportDate) }
  );
  const data = salesQuery.data;
  const balances = (data?.balances ?? []) as StockBalance[];
  const stockInReasons = (data?.stockInReasons ?? []) as StockInReason[];

  const reasonsBySkuStep = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const row of stockInReasons) {
      const key = stockKey(row.skuName, row.step);
      const current = result.get(key) ?? [];
      if (!current.includes(row.reason)) current.push(row.reason);
      result.set(key, current);
    }
    return result;
  }, [stockInReasons]);

  const summary = useMemo(() => {
    const result = { totalBeforeOut: 0, step14: 0, step15: 0, step16: 0 };
    for (const balance of balances) {
      result.totalBeforeOut += opening(balance) + dailyIn(balance);
      const net = closing(balance);
      if (balance.step === 14) result.step14 += net;
      if (balance.step === 15) result.step15 += net;
      if (balance.step === 16) result.step16 += net;
    }
    return {
      ...result,
      remaining: result.step14 + result.step15 + result.step16,
    };
  }, [balances]);

  const cardDetails = useMemo(() => {
    if (!selectedCard || !data) return [] as DetailRow[];
    if (selectedCard === "allIn") {
      const openingRows = balances
        .filter(balance => opening(balance) > 0)
        .map(balance => ({
          skuName: balance.skuName,
          step: balance.step,
          qty: opening(balance),
          reason: "Saldo awal (sisa hari sebelumnya)",
        }));
      const dailyRows = stockInReasons.map(row => ({
        skuName: row.skuName,
        step: row.step,
        qty: numberValue(row.qty),
        reason: row.reason,
      }));
      return [...openingRows, ...dailyRows].sort(
        (left, right) =>
          left.skuName.localeCompare(right.skuName, "id") ||
          left.step - right.step ||
          left.reason.localeCompare(right.reason, "id")
      );
    }

    const stepFilter =
      selectedCard === "step14"
        ? 14
        : selectedCard === "step15"
          ? 15
          : selectedCard === "step16"
            ? 16
            : null;
    return balances
      .filter(balance => stepFilter === null || balance.step === stepFilter)
      .map(balance => {
        const reasons = reasonsBySkuStep.get(
          stockKey(balance.skuName, balance.step)
        ) ?? [];
        const reasonParts = [
          opening(balance) > 0 ? "Saldo awal (sisa hari sebelumnya)" : "",
          ...reasons,
        ].filter(Boolean);
        return {
          skuName: balance.skuName,
          step: balance.step,
          qty: closing(balance),
          reason: reasonParts.join("; ") || "—",
        };
      })
      .filter(row => row.qty > 0)
      .sort(
        (left, right) =>
          left.skuName.localeCompare(right.skuName, "id") ||
          left.step - right.step
      );
  }, [balances, data, reasonsBySkuStep, selectedCard, stockInReasons]);

  const stockOutRows = useMemo(
    () =>
      balances
        .filter(balance => numberValue(balance.stockOut) > 0)
        .sort(
          (left, right) =>
            left.skuName.localeCompare(right.skuName, "id") ||
            left.step - right.step
        ),
    [balances]
  );
  const stockOutTotals = useMemo(
    () =>
      stockOutRows.reduce(
        (totals, row) => ({
          logistics: totals.logistics + numberValue(row.logisticsOut),
          production: totals.production + numberValue(row.productionOut),
          total: totals.total + numberValue(row.stockOut),
        }),
        { logistics: 0, production: 0, total: 0 }
      ),
    [stockOutRows]
  );

  const cards: Array<{
    key: CardKey;
    title: string;
    value: number;
    note: string;
    className: string;
  }> = [
    {
      key: "allIn",
      title: "TOTAL PISANG ALL STEP",
      value: summary.totalBeforeOut,
      note: "Saldo awal + Stock In hari ini",
      className: "sales-card-all-in",
    },
    {
      key: "step14",
      title: "STOCK STEP 1.4",
      value: summary.step14,
      note: "Sisa akhir hari",
      className: "sales-card-step-14",
    },
    {
      key: "step15",
      title: "STOCK STEP 1.5",
      value: summary.step15,
      note: "Sisa akhir hari",
      className: "sales-card-step-15",
    },
    {
      key: "step16",
      title: "STOCK STEP 1.6",
      value: summary.step16,
      note: "Sisa akhir hari",
      className: "sales-card-step-16",
    },
    {
      key: "remaining",
      title: "STOCK SISA PISANG",
      value: summary.remaining,
      note: "Saldo akhir semua step",
      className: "sales-card-remaining",
    },
  ];

  const selectedTitle = cards.find(card => card.key === selectedCard)?.title;
  const selectedQtyLabel = selectedCard === "allIn" ? "Qty tersedia" : "Qty Sisa";

  return (
    <div className="sales-page-shell">
      <header className="sales-topbar">
        <a className="sales-brand" href="/" aria-label="Kembali ke SCM Logistik">
          <img src="/sunpride-scm-east-logo.webp" alt="Sunpride SCM East" />
          <span>SCM LOGISTIK</span>
        </a>
        <span className="sales-readonly-badge">
          <CheckCircle2 size={14} /> READ ONLY
        </span>
      </header>

      <main className="sales-content">
        <section className="sales-heading">
          <div>
            <p className="sales-kicker"><BarChart3 size={14} /> SALES DISPLAY</p>
            <h1>Ringkasan Stock Pisang</h1>
            <p className="sales-subtitle">
              Hanya saldo awal yang tersisa dan pergerakan pada tanggal laporan; histori lintas hari ada di Excel.
            </p>
          </div>
          <div className="sales-date-control">
            <label htmlFor="sales-report-date"><CalendarDays size={15} /> Tanggal laporan</label>
            <Input
              id="sales-report-date"
              type="date"
              value={reportDate}
              onChange={event => setReportDate(event.target.value)}
            />
          </div>
        </section>

        {salesQuery.isError ? (
          <div className="sales-status error">
            <Activity size={16} /> Gagal memuat data sales. Periksa koneksi lalu coba lagi.
          </div>
        ) : null}
        {salesQuery.isFetching && !data ? (
          <div className="sales-status"><RefreshCw size={16} /> Memuat snapshot tanggal laporan…</div>
        ) : null}

        <section className="sales-card-grid" aria-label="Ringkasan stock">
          {cards.map(card => (
            <button
              key={card.key}
              type="button"
              className={`sales-card ${card.className}${selectedCard === card.key ? " is-selected" : ""}`}
              onClick={() => setSelectedCard(current => current === card.key ? null : card.key)}
              aria-expanded={selectedCard === card.key}
              aria-controls="sales-card-details"
              disabled={salesQuery.isLoading || salesQuery.isError}
            >
              <span className="sales-card-title">{card.title}</span>
              <strong>{salesQuery.isLoading ? "—" : displayNumber(card.value)}</strong>
              <span className="sales-card-note">{card.note}</span>
            </button>
          ))}
        </section>

        {selectedCard ? (
          <section className="sales-detail-panel" id="sales-card-details">
            <div className="sales-panel-heading">
              <div>
                <p className="sales-kicker">RINCIAN KARTU</p>
                <h2>{selectedTitle}</h2>
                <span>Pergerakan tanggal {displayDate(reportDate)}; saldo dari hari sebelumnya hanya ditampilkan sebagai saldo awal.</span>
              </div>
              <button type="button" onClick={() => setSelectedCard(null)} aria-label="Tutup rincian">
                Tutup
              </button>
            </div>
            <div className="sales-table-wrap">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Nama SKU</th>
                    <th>Step</th>
                    <th className="align-right">{selectedQtyLabel}</th>
                    <th>Reason Stock In / Saldo Awal</th>
                  </tr>
                </thead>
                <tbody>
                  {cardDetails.length ? cardDetails.map((row, index) => (
                    <tr key={`${row.skuName}|${row.step}|${row.reason}|${index}`}>
                      <td>{row.skuName}</td>
                      <td><span className={`step-badge step-${row.step}`}>STEP {stepLabel(row.step)}</span></td>
                      <td className="align-right qty-table">{displayNumber(row.qty)}</td>
                      <td>{row.reason}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="empty-row">Tidak ada saldo atau Stock In pada tanggal tersebut.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="sales-stockout-panel">
          <div className="sales-panel-heading">
            <div>
              <p className="sales-kicker"><Activity size={14} /> STOCK OUT HARI INI</p>
              <h2>Total Qty Keluar</h2>
              <span>Transaksi tanggal {displayDate(reportDate)}</span>
            </div>
            {salesQuery.isFetching ? <span className="sales-loading"><RefreshCw size={14} /> Memuat</span> : null}
          </div>
          <div className="sales-table-wrap">
            <table className="sales-table sales-stockout-table">
              <thead>
                <tr>
                  <th>Nama SKU</th>
                  <th>Step</th>
                  <th className="align-right">Keluar Logistik</th>
                  <th className="align-right">Keluar Produksi</th>
                  <th className="align-right">Total Qty Keluar</th>
                </tr>
              </thead>
              <tbody>
                {stockOutRows.length ? stockOutRows.map(row => (
                  <tr key={`${row.skuName}|${row.step}`}>
                    <td>{row.skuName}</td>
                    <td><span className={`step-badge step-${row.step}`}>STEP {stepLabel(row.step)}</span></td>
                    <td className="align-right qty-table">{displayNumber(numberValue(row.logisticsOut))}</td>
                    <td className="align-right qty-table">{displayNumber(numberValue(row.productionOut))}</td>
                    <td className="align-right qty-table">{displayNumber(numberValue(row.stockOut))}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="empty-row">Belum ada Stock Out pada tanggal ini.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>TOTAL HARI INI</td>
                  <td className="align-right">{displayNumber(stockOutTotals.logistics)}</td>
                  <td className="align-right">{displayNumber(stockOutTotals.production)}</td>
                  <td className="align-right">{displayNumber(stockOutTotals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <footer className="sales-footer">
          <PackageCheck size={15} /> Read-only · Zona waktu Asia/Jakarta · Snapshot {displayDate(reportDate)}
        </footer>
      </main>
    </div>
  );
}
