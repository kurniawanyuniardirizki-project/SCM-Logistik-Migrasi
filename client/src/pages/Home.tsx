import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Menu,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { downloadStockHistoryXlsx } from "@/lib/stockExcel";
import { BUSINESS_TIME_ZONE } from "@shared/const";
import {
  getBusinessDateInput,
  millisecondsUntilNextBusinessMidnight,
} from "@/lib/businessDate";

const SKU_NAMES = [
  "Sunpride Cavendish Bn C3 13KG",
  "Sunpride Cavendish Bn Family 20PX",
  "Sunpride Cavendish Bn C5 5KG",
  "Sunpride Cavendish Bn Single 10PCS",
  "Sunpride Cavendish Bn Sml Hand 13KG",
  "Sunpride Gold Cavendish Bn H 18PX",
  "Sunpride A Cavendish Bn FS 13KG",
  "Sunpride A Cavendish Bn FS1 13KG",
  "Sunpride A Cavendish Bn FB 13KG",
  "Sunpride A Cavendish Bn FB1 13KG",
  "Sunpride A Cavendish Bn FK 13KG",
  "Sunpride A Cavendish Bn SWEETY 13KG",
  "Sunpride Cavendish Bn Couple 10PX",
  "Sunpride Cavendish Bn Mini 25PX",
  "sunpride a cavendish bn C13 TANGGAMUS",
  "sunpride a cavendish bn C3B TANGGAMUS",
  "sunpride a cavendish bn FB TANGGAMUS",
  "sunpride a cavendish bn C13 SUN FRESH",
  "sunpride a cavendish bn C3B SUN FRESH",
  "sunpride a cavendish bn FB SUN FRESH",
];

type NumericField =
  | "logistics14"
  | "logistics15"
  | "logistics16"
  | "additional14"
  | "additional15"
  | "additional16"
  | "rejectQty";

type ReportRow = {
  skuOrder: number;
  skuName: string;
  logistics14: string;
  logistics15: string;
  logistics16: string;
  additional14: string;
  additional15: string;
  additional16: string;
  stockOut14: string;
  stockOut15: string;
  stockOut16: string;
  rejectQty: string;
  remark: string;
  openingStock?: string;
  opening14?: string;
  opening15?: string;
  opening16?: string;
  closingStock?: string;
};

type MovementType = "in" | "out" | "reject";
type StockOutSource = "logistics" | "production" | "both";
type ReportBalance = {
  skuName: string;
  step: number;
  logisticsIn: string | number;
  productionIn: string | number;
  stockOut: string | number;
  rejectQty: string | number;
  openingStock?: string | number;
  closingStock?: string | number;
};

const INPUT_FIELDS: NumericField[] = [
  "logistics14",
  "logistics15",
  "logistics16",
  "additional14",
  "additional15",
  "additional16",
];

const STOCK_REASONS = ["return", "sisa jual", "stock produksi"];
const STOCK_IN_REASONS = [...STOCK_REASONS, "Pindah SKU"];
const TRANSFER_IN_REASONS = ["return", "sisa jual", "tambahan produksi"] as const;
type TransferInReason = (typeof TRANSFER_IN_REASONS)[number];
const TRANSFER_REASON = "Pindah SKU";

function makeBlankRow(skuName: string, index: number): ReportRow {
  return {
    skuOrder: index + 1,
    skuName,
    logistics14: "",
    logistics15: "",
    logistics16: "",
    additional14: "",
    additional15: "",
    additional16: "",
    stockOut14: "",
    stockOut15: "",
    stockOut16: "",
    rejectQty: "",
    remark: "",
  };
}

function makeBlankRows(): ReportRow[] {
  return SKU_NAMES.map((skuName, index) => makeBlankRow(skuName, index));
}

function numberValue(value: string | number | null | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function rowTotal(row: ReportRow) {
  return INPUT_FIELDS.reduce((sum, field) => sum + numberValue(row[field]), 0);
}

function rowTotalIn(row: ReportRow) {
  return numberValue(row.openingStock) + rowTotal(row);
}

function rowRemaining(row: ReportRow) {
  if (row.closingStock !== undefined) return numberValue(row.closingStock);
  const stockOut =
    numberValue(row.stockOut14) +
    numberValue(row.stockOut15) +
    numberValue(row.stockOut16);
  return (
    rowTotalIn(row) -
    stockOut -
    numberValue(row.rejectQty)
  );
}

function displayNumber(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(
    value
  );
}

function displayTableNumber(value: number) {
  return value === 0 ? "" : displayNumber(value);
}

function displayDate(date: string) {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString("id-ID", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value: Date | string | number) {
  return new Date(value).toLocaleString("id-ID", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function movementLabel(type: MovementType) {
  if (type === "in") return "Stock In";
  if (type === "out") return "Stock Out";
  return "Reject";
}

function activityKind(type: MovementType, reason: string) {
  if (type === "reject")
    return { label: "REJECT", className: "reject" } as const;
  if (reason.trim().toLowerCase() === "return")
    return { label: "RETURN", className: "return" } as const;
  if (type === "in") return { label: "IN", className: "in" } as const;
  return { label: "OUT", className: "out" } as const;
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(getBusinessDateInput);
  const [isFollowingCurrentDay, setIsFollowingCurrentDay] = useState(true);
  const timeZone = BUSINESS_TIME_ZONE;
  const [rows, setRows] = useState<ReportRow[]>(makeBlankRows);
  const [isDirty, setIsDirty] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [movementType, setMovementType] = useState<MovementType>("in");
  const [selectedSku, setSelectedSku] = useState(SKU_NAMES[0]);
  const [selectedSourceSku, setSelectedSourceSku] = useState(SKU_NAMES[1]);
  const [selectedStep, setSelectedStep] = useState("14");
  const [stockQty, setStockQty] = useState("");
  const [stockReason, setStockReason] = useState(STOCK_REASONS[0]);
  const [transferInReason, setTransferInReason] = useState<
    TransferInReason | ""
  >("");
  const [stockOutSource, setStockOutSource] = useState<StockOutSource>("both");
  const [selectedCardStep, setSelectedCardStep] = useState<
    number | "reject" | null
  >(null);
  const [historyFromDate, setHistoryFromDate] = useState(selectedDate);
  const [historyToDate, setHistoryToDate] = useState(selectedDate);

  const reportQuery = trpc.report.getByDate.useQuery({
    reportDate: selectedDate,
  });
  const stockQuery = trpc.stock.list.useQuery({
    reportDate: selectedDate,
    timeZone,
  });
  const currentStockQuery = trpc.stock.outAvailability.useQuery();
  const reportBalances = (stockQuery.data?.balances ?? []) as ReportBalance[];
  const skuOptions = useMemo(() => {
    const names = new Set<string>([
      ...SKU_NAMES,
      ...rows.map(row => row.skuName),
      ...(stockQuery.data?.balances ?? []).map(balance => balance.skuName),
      ...(stockQuery.data?.transactions ?? []).map(
        transaction => transaction.skuName
      ),
    ]);
    return Array.from(names).sort((left, right) => {
      const leftIndex = SKU_NAMES.indexOf(left);
      const rightIndex = SKU_NAMES.indexOf(right);
      if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
      if (leftIndex >= 0) return -1;
      if (rightIndex >= 0) return 1;
      return left.localeCompare(right, "id");
    });
  }, [rows, stockQuery.data?.balances, stockQuery.data?.transactions]);
  const historyQuery = trpc.stock.history.useQuery(
    { fromDate: historyFromDate, toDate: historyToDate, timeZone },
    {
      enabled: Boolean(
        historyFromDate && historyToDate && historyFromDate <= historyToDate
      ),
    }
  );
  const utils = trpc.useUtils();

  useEffect(() => {
    setHistoryFromDate(selectedDate);
    setHistoryToDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!isFollowingCurrentDay) return;

    let timerId: number;
    const syncCurrentDate = () => {
      const currentBusinessDate = getBusinessDateInput();
      setSelectedDate(current =>
        current === currentBusinessDate ? current : currentBusinessDate
      );
    };
    const scheduleNextMidnight = () => {
      timerId = window.setTimeout(() => {
        syncCurrentDate();
        scheduleNextMidnight();
      }, millisecondsUntilNextBusinessMidnight() + 50);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") syncCurrentDate();
    };

    scheduleNextMidnight();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", syncCurrentDate);
    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", syncCurrentDate);
    };
  }, [isFollowingCurrentDay]);

  const saveMutation = trpc.report.save.useMutation({
    onSuccess: saved => {
      if (saved) {
        setRows(
          saved.items.map(item => ({
            skuOrder: item.skuOrder,
            skuName: item.skuName,
            logistics14: item.logistics14 ?? "",
            logistics15: item.logistics15 ?? "",
            logistics16: item.logistics16 ?? "",
            additional14: item.additional14 ?? "",
            additional15: item.additional15 ?? "",
            additional16: item.additional16 ?? "",
            stockOut14: "0",
            stockOut15: "0",
            stockOut16: "0",
            rejectQty: item.rejectQty ?? "",
            remark: item.remark ?? "",
          }))
        );
      }
      setIsDirty(false);
      toast.success("Laporan berhasil disimpan", {
        description: `Laporan ${displayDate(selectedDate)} sudah tersimpan.`,
      });
    },
    onError: error =>
      toast.error("Gagal menyimpan laporan", { description: error.message }),
  });

  const stockMutation = trpc.stock.post.useMutation({
    onSuccess: transaction => {
      setStockQty("");
      utils.stock.list.invalidate({ reportDate: selectedDate, timeZone });
      utils.stock.outAvailability.invalidate();
      toast.success(
        `${movementLabel(transaction.movementType as MovementType)} berhasil diposting`,
        {
          description: `${transaction.skuName} · Step ${transaction.step} · ${transaction.qty}`,
        }
      );
    },
    onError: error =>
      toast.error("Gagal posting stock", { description: error.message }),
  });

  const transferMutation = trpc.stock.transfer.useMutation({
    onSuccess: () => {
      setStockQty("");
      setTransferInReason("");
      utils.stock.list.invalidate({ reportDate: selectedDate, timeZone });
      utils.stock.outAvailability.invalidate();
      utils.report.getByDate.invalidate({ reportDate: selectedDate });
      if (historyFromDate <= historyToDate) {
        utils.stock.history.invalidate({
          fromDate: historyFromDate,
          toDate: historyToDate,
          timeZone,
        });
      }
      toast.success("Pindah SKU berhasil diposting", {
        description: `${selectedSourceSku} → ${selectedSku} · Step ${selectedStep} · ${stockQty}`,
      });
    },
    onError: error =>
      toast.error("Gagal pindah SKU", { description: error.message }),
  });

  useEffect(() => {
    if (reportQuery.isFetching) return;
    if (reportQuery.data?.items) {
      setRows(
        reportQuery.data.items.map(item => ({
          skuOrder: item.skuOrder,
          skuName: item.skuName,
          logistics14: item.logistics14 ?? "",
          logistics15: item.logistics15 ?? "",
          logistics16: item.logistics16 ?? "",
          additional14: item.additional14 ?? "",
          additional15: item.additional15 ?? "",
          additional16: item.additional16 ?? "",
          stockOut14: "0",
          stockOut15: "0",
          stockOut16: "0",
          rejectQty: item.rejectQty ?? "",
          remark: item.remark ?? "",
        }))
      );
    } else {
      setRows(makeBlankRows());
    }
    setIsDirty(false);
  }, [reportQuery.data, reportQuery.isFetching, selectedDate]);

  const stockSummary = stockQuery.data?.summary ?? {
    step14: 0,
    step15: 0,
    step16: 0,
    reject: 0,
    totalIn: 0,
    totalOut: 0,
  };
  const selectedCurrentBalance = currentStockQuery.data?.find(
    balance =>
      balance.skuName === selectedSku && balance.step === Number(selectedStep)
  );
  const availableLogistics = Math.max(
    0,
    numberValue(selectedCurrentBalance?.logisticsAvailable)
  );
  const availableProduction = Math.max(
    0,
    numberValue(selectedCurrentBalance?.productionAvailable)
  );
  const isSkuTransfer =
    movementType === "in" && stockReason === TRANSFER_REASON;
  const cardStockRows = useMemo(() => {
    if (selectedCardStep === null) return [];
    return reportBalances
      .filter(balance =>
        selectedCardStep === "reject"
          ? numberValue(balance.rejectQty) !== 0
          : balance.step === selectedCardStep
      )
      .map(balance => ({
        skuName: balance.skuName,
        qty:
          selectedCardStep === "reject"
            ? numberValue(balance.rejectQty)
            : numberValue(balance.closingStock),
      }))
      .filter(row => row.qty > 0)
      .sort((left, right) => left.skuName.localeCompare(right.skuName, "id"));
  }, [reportBalances, selectedCardStep]);

  const allDisplayRows = useMemo(() => {
    const rowsBySku = new Map(rows.map(row => [row.skuName, row] as const));
    const bySkuStep = new Map(
      reportBalances.map(
        balance => [`${balance.skuName}|${balance.step}`, balance] as const
      )
    );
    return skuOptions.map((skuName, index) => {
      const row = rowsBySku.get(skuName) ?? makeBlankRow(skuName, index);
      return {
      ...row,
      skuOrder: index + 1,
      skuName,
      opening14: String(
        bySkuStep.get(`${row.skuName}|14`)?.openingStock ?? 0
      ),
      opening15: String(
        bySkuStep.get(`${row.skuName}|15`)?.openingStock ?? 0
      ),
      opening16: String(
        bySkuStep.get(`${row.skuName}|16`)?.openingStock ?? 0
      ),
      openingStock: String(
        [14, 15, 16].reduce(
          (sum, step) =>
            sum +
            numberValue(bySkuStep.get(`${row.skuName}|${step}`)?.openingStock),
          0
        )
      ),
      closingStock: String(
        [14, 15, 16].reduce(
          (sum, step) =>
            sum +
            numberValue(bySkuStep.get(`${row.skuName}|${step}`)?.closingStock),
          0
        )
      ),
      logistics14: String(bySkuStep.get(`${row.skuName}|14`)?.logisticsIn ?? 0),
      logistics15: String(bySkuStep.get(`${row.skuName}|15`)?.logisticsIn ?? 0),
      logistics16: String(bySkuStep.get(`${row.skuName}|16`)?.logisticsIn ?? 0),
      additional14: String(
        bySkuStep.get(`${row.skuName}|14`)?.productionIn ?? 0
      ),
      additional15: String(
        bySkuStep.get(`${row.skuName}|15`)?.productionIn ?? 0
      ),
      additional16: String(
        bySkuStep.get(`${row.skuName}|16`)?.productionIn ?? 0
      ),
      stockOut14: String(bySkuStep.get(`${row.skuName}|14`)?.stockOut ?? 0),
      stockOut15: String(bySkuStep.get(`${row.skuName}|15`)?.stockOut ?? 0),
      stockOut16: String(bySkuStep.get(`${row.skuName}|16`)?.stockOut ?? 0),
      rejectQty: String(
        [14, 15, 16].reduce(
          (sum, step) =>
            sum +
            numberValue(bySkuStep.get(`${row.skuName}|${step}`)?.rejectQty),
          0
        )
      ),
      };
    });
  }, [reportBalances, rows, skuOptions]);

  const displayRows = useMemo(
    () =>
      allDisplayRows.filter(
        row =>
          rowRemaining(row) > 0 ||
          rowTotal(row) > 0 ||
          numberValue(row.stockOut14) +
            numberValue(row.stockOut15) +
            numberValue(row.stockOut16) >
            0 ||
          numberValue(row.rejectQty) > 0
      ),
    [allDisplayRows]
  );

  const reportSummary = useMemo(() => {
    const total = allDisplayRows.reduce(
      (sum, row) => sum + rowTotalIn(row),
      0
    );
    const remaining = allDisplayRows.reduce(
      (sum, row) => sum + rowRemaining(row),
      0
    );
    const opening14 = allDisplayRows.reduce(
      (sum, row) => sum + numberValue(row.opening14),
      0
    );
    const opening15 = allDisplayRows.reduce(
      (sum, row) => sum + numberValue(row.opening15),
      0
    );
    const opening16 = allDisplayRows.reduce(
      (sum, row) => sum + numberValue(row.opening16),
      0
    );
    return { total, remaining, opening14, opening15, opening16 };
  }, [allDisplayRows]);

  const updateRow = (
    index: number,
    field: NumericField | "remark",
    value: string
  ) => {
    setRows(current =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
    setIsDirty(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      reportDate: selectedDate,
      items: rows.map(row => ({
        ...row,
        doQty: "0",
        additional14: row.additional14 || "0",
        additional15: row.additional15 || "0",
        additional16: row.additional16 || "0",
        logistics14: row.logistics14 || "0",
        logistics15: row.logistics15 || "0",
        logistics16: row.logistics16 || "0",
        rejectQty: row.rejectQty || "0",
        remark: row.remark || null,
      })),
    });
  };

  const handlePostStock = () => {
    const qtyInput = stockQty.trim();
    const qty = numberValue(qtyInput);
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(qtyInput) || !qty || qty <= 0) {
      toast.error("Qty belum valid", {
        description: "Masukkan qty lebih besar dari 0.",
      });
      return;
    }
    if (!stockReason.trim()) {
      toast.error("Reason wajib diisi", {
        description: "Tulis alasan untuk transaksi stock.",
      });
      return;
    }
    if (movementType === "in" && stockReason === TRANSFER_REASON) {
      if (!transferInReason) {
        toast.error("Reason Stock In wajib dipilih");
        return;
      }
      if (selectedSourceSku === selectedSku) {
        toast.error("SKU asal dan tujuan harus berbeda", {
          description: "Pilih SKU yang berbeda untuk sumber dan tujuan.",
        });
        return;
      }
      transferMutation.mutate({
        sourceSku: selectedSourceSku,
        targetSku: selectedSku,
        step: Number(selectedStep) as 14 | 15 | 16,
        qty: qtyInput,
        reason: transferInReason,
      });
      return;
    }
    stockMutation.mutate({
      movementType,
      skuName: selectedSku,
      step: Number(selectedStep) as 14 | 15 | 16,
      qty: qtyInput,
      reason: stockReason,
      ...(movementType === "out" ? { stockOutSource } : {}),
    });
  };

  const handleMovementTypeChange = (nextType: MovementType) => {
    setMovementType(nextType);
    setStockReason(nextType === "out" ? "" : STOCK_REASONS[0]);
    setTransferInReason("");
    if (nextType === "out") setStockOutSource("both");
  };

  const handleReset = () => {
    if (
      isDirty &&
      !window.confirm("Perubahan yang belum disimpan akan hilang. Lanjutkan?")
    )
      return;
    setRows(makeBlankRows());
    setIsDirty(true);
  };

  const handleExportHistoryExcel = async () => {
    if (!historyFromDate || !historyToDate || historyFromDate > historyToDate) {
      toast.error("Rentang tanggal belum valid", {
        description:
          "Tanggal mulai harus sama dengan atau sebelum tanggal akhir.",
      });
      return;
    }
    if (historyQuery.isFetching) {
      toast.info("Riwayat masih dimuat", {
        description: "Tunggu sampai data selesai dimuat sebelum mengekspor.",
      });
      return;
    }
    if (historyQuery.isError) {
      toast.error("Riwayat gagal dimuat", {
        description: "Ubah rentang tanggal lalu coba kembali.",
      });
      return;
    }
    const historyRows = historyQuery.data;
    if (!historyRows) {
      toast.info("Riwayat belum dimuat", {
        description: "Tunggu sampai rentang selesai dimuat sebelum mengekspor.",
      });
      return;
    }
    await downloadStockHistoryXlsx(historyRows, historyFromDate, historyToDate);
    toast.success("Excel riwayat transaksi berhasil dibuat", {
      description: `${historyRows.length} transaksi dalam rentang terpilih.`,
    });
  };

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${mobileMenuOpen ? "is-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark">
            <img src="/sunpride-scm-east-logo.webp" alt="Sunpride SCM East" />
          </div>
          <div>
            <div className="brand-name">
              SUNPRIDE<span>.</span>
            </div>
            <div className="brand-caption">OPERATIONS REPORT</div>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Tutup menu"
          >
            <X size={19} />
          </button>
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav">
          <button className="sidebar-link active">
            <ClipboardList size={18} />
            <span>Dashboard</span>
            <span className="nav-dot" />
          </button>
          <button
            className="sidebar-link"
            onClick={() =>
              document
                .getElementById("stock-posting")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Plus size={18} />
            <span>Posting Stock</span>
          </button>
          <button
            className="sidebar-link"
            onClick={() =>
              document
                .getElementById("stock-activity")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Activity size={18} />
            <span>Aktivitas Stock</span>
          </button>
          <button
            className="sidebar-link"
            onClick={() =>
              document
                .getElementById("stock-history")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <FileSpreadsheet size={18} />
            <span>Tarik Data Excel</span>
          </button>
          <a className="sidebar-link sales-sidebar-link" href="/sales">
            <BarChart3 size={18} />
            <span>Sales Display</span>
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="note-icon">
              <PackageCheck size={17} />
            </div>
            <div>
              <strong>Alur kerja rapi</strong>
              <span>Input → Cek → Posting</span>
            </div>
          </div>
          <div className="sidebar-version">SCM Logistik · v1.1</div>
        </div>
      </aside>
      {mobileMenuOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Tutup menu"
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu"
            >
              <Menu size={21} />
            </button>
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" /> DAILY OPERATIONS
              </div>
              <h1>SCM Logistik</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="status-pill">
              <span className="status-indicator" /> Sistem aktif
            </div>
            <div className="user-chip">
              <span className="user-avatar">OP</span>
              <span className="user-label">Operations</span>
            </div>
          </div>
        </header>

        <div className="content-wrap">
          <section className="hero-row">
            <div>
              <p className="section-kicker">MONITORING HARIAN</p>
              <h2></h2>
              <p className="section-description"></p>
            </div>
            <div className="date-control">
              <CalendarDays size={17} />
              <label htmlFor="report-date">Tanggal laporan</label>
              <Input
                id="report-date"
                type="date"
                value={selectedDate}
                onChange={event => {
                  const nextDate = event.target.value;
                  if (!nextDate) return;
                  setSelectedDate(nextDate);
                  setIsFollowingCurrentDay(nextDate === getBusinessDateInput());
                }}
              />
            </div>
          </section>

          <section className="stock-cards-section">
            <div className="section-inline-heading">
              <div>
                <p className="section-kicker">STOCK BOARD</p>
                <h2>Sisa stock per step</h2>
              </div>
            </div>
            <div className="stock-card-grid">
              <button
                type="button"
                className={`stock-card step-14 ${selectedCardStep === 14 ? "is-selected" : ""}`}
                onClick={() =>
                  setSelectedCardStep(selectedCardStep === 14 ? null : 14)
                }
              >
                <div className="stock-card-top">
                  <span className="stock-step">STEP 14</span>
                  <ArrowDownToLine size={18} />
                </div>
                <strong>{displayNumber(stockSummary.step14)}</strong>
                <span>Sisa stock · klik untuk detail</span>
              </button>
              <button
                type="button"
                className={`stock-card step-15 ${selectedCardStep === 15 ? "is-selected" : ""}`}
                onClick={() =>
                  setSelectedCardStep(selectedCardStep === 15 ? null : 15)
                }
              >
                <div className="stock-card-top">
                  <span className="stock-step">STEP 15</span>
                  <ArrowDownToLine size={18} />
                </div>
                <strong>{displayNumber(stockSummary.step15)}</strong>
                <span>Sisa stock · klik untuk detail</span>
              </button>
              <button
                type="button"
                className={`stock-card step-16 ${selectedCardStep === 16 ? "is-selected" : ""}`}
                onClick={() =>
                  setSelectedCardStep(selectedCardStep === 16 ? null : 16)
                }
              >
                <div className="stock-card-top">
                  <span className="stock-step">STEP 16</span>
                  <ArrowDownToLine size={18} />
                </div>
                <strong>{displayNumber(stockSummary.step16)}</strong>
                <span>Sisa stock · klik untuk detail</span>
              </button>
              <button
                type="button"
                className={`stock-card step-reject ${selectedCardStep === "reject" ? "is-selected" : ""}`}
                onClick={() =>
                  setSelectedCardStep(
                    selectedCardStep === "reject" ? null : "reject"
                  )
                }
              >
                <div className="stock-card-top">
                  <span className="stock-step">REJECT</span>
                  <AlertTriangle size={18} />
                </div>
                <strong>{displayNumber(stockSummary.reject)}</strong>
                <span>Sisa reject · klik untuk detail</span>
              </button>
            </div>
            {selectedCardStep !== null && (
              <div className="card-detail">
                <div className="card-detail-heading">
                  <strong>
                    {selectedCardStep === "reject"
                      ? "Detail Reject"
                      : `Detail Step ${selectedCardStep}`}
                  </strong>
                  <button
                    type="button"
                    onClick={() => setSelectedCardStep(null)}
                    aria-label="Tutup detail"
                  >
                    <X size={15} />
                  </button>
                </div>
                {cardStockRows.length ? (
                  cardStockRows.map(row => (
                    <div className="card-detail-row" key={row.skuName}>
                      <span>{row.skuName}</span>
                      <strong>{displayTableNumber(row.qty)}</strong>
                    </div>
                  ))
                ) : (
                  <div className="card-detail-empty">
                    Belum ada sisa stock untuk tanggal ini.
                  </div>
                )}
              </div>
            )}
          </section>
          <section className="stock-posting-panel" id="stock-posting">
            <div className="posting-heading">
              <div className="panel-title">
                <div className="panel-title-icon posting-icon">
                  <Plus size={18} />
                </div>
                <div>
                  <h3>Posting stock</h3>
                  <p>Tanggal & jam tercatat otomatis saat posting</p>
                </div>
              </div>
              <span className="live-label">
                <span /> LIVE ENTRY
              </span>
            </div>
            <div className="posting-form">
              <div
                className="movement-toggle"
                role="group"
                aria-label="Jenis transaksi"
              >
                <button
                  type="button"
                  className={movementType === "in" ? "selected in" : ""}
                  onClick={() => handleMovementTypeChange("in")}
                >
                  <ArrowDownToLine size={15} /> Stock In
                </button>
                <button
                  type="button"
                  className={movementType === "out" ? "selected out" : ""}
                  onClick={() => handleMovementTypeChange("out")}
                >
                  <ArrowUpFromLine size={15} /> Stock Out
                </button>
                <button
                  type="button"
                  className={movementType === "reject" ? "selected reject" : ""}
                  onClick={() => handleMovementTypeChange("reject")}
                >
                  <AlertTriangle size={15} /> Reject
                </button>
              </div>
              {isSkuTransfer && (
                <div className="posting-field">
                  <label htmlFor="stock-source-sku">SKU Asal</label>
                  <select
                    id="stock-source-sku"
                    value={selectedSourceSku}
                    onChange={event => setSelectedSourceSku(event.target.value)}
                  >
                    {skuOptions.map(sku => (
                      <option key={sku} value={sku}>
                        {sku}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="posting-field">
                <label htmlFor="stock-sku">
                  {isSkuTransfer ? "SKU Tujuan" : "SKU"}
                </label>
                <select
                  id="stock-sku"
                  value={selectedSku}
                  onChange={event => setSelectedSku(event.target.value)}
                >
                  {skuOptions.map(sku => (
                    <option key={sku} value={sku}>
                      {sku}
                    </option>
                  ))}
                </select>
              </div>
              <div className="posting-field step-field">
                <label htmlFor="stock-step">Step</label>
                <select
                  id="stock-step"
                  value={selectedStep}
                  onChange={event => setSelectedStep(event.target.value)}
                >
                  <option value="14">14</option>
                  <option value="15">15</option>
                  <option value="16">16</option>
                </select>
              </div>
              <div className="posting-field reason-field">
                <label htmlFor="stock-reason">Reason</label>
                {movementType === "out" ? (
                  <Input
                    id="stock-reason"
                    value={stockReason}
                    placeholder="Tulis alasan stock out"
                    onChange={event => setStockReason(event.target.value)}
                  />
                ) : (
                  <select
                    id="stock-reason"
                    className="reason-select"
                    value={stockReason}
                    onChange={event => {
                      const reason = event.target.value;
                      setStockReason(reason);
                      if (reason === TRANSFER_REASON) setTransferInReason("");
                    }}
                  >
                    {(movementType === "in"
                      ? STOCK_IN_REASONS
                      : STOCK_REASONS
                    ).map(reason => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                )}
                {isSkuTransfer && (
                  <>
                    <label htmlFor="stock-transfer-in-reason">
                      Reason Stock In
                    </label>
                    <select
                      id="stock-transfer-in-reason"
                      className="reason-select"
                      value={transferInReason}
                      onChange={event =>
                        setTransferInReason(
                          event.target.value as TransferInReason | ""
                        )
                      }
                    >
                      <option value="">Pilih reason Stock In</option>
                      {TRANSFER_IN_REASONS.map(reason => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              <div className="posting-field qty-field">
                <label htmlFor="stock-qty">Qty</label>
                <Input
                  id="stock-qty"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={stockQty}
                  onChange={event => setStockQty(event.target.value)}
                />
              </div>
              <Button
                className="post-button"
                onClick={handlePostStock}
                disabled={stockMutation.isPending || transferMutation.isPending}
              >
                <Plus size={16} />{" "}
                {stockMutation.isPending || transferMutation.isPending
                  ? "Posting..."
                  : "Posting"}
              </Button>
              {movementType === "out" ? (
                <div className="posting-field stock-out-source-field">
                  <label htmlFor="stock-out-source">Ambil stock dari</label>
                  <select
                    id="stock-out-source"
                    value={stockOutSource}
                    aria-describedby="stock-out-source-hint"
                    onChange={event =>
                      setStockOutSource(event.target.value as StockOutSource)
                    }
                  >
                    <option value="logistics">
                      Stock Logistik · {displayNumber(availableLogistics)}
                    </option>
                    <option value="production">
                      Stock Produksi · {displayNumber(availableProduction)}
                    </option>
                    <option value="both">
                      Gabungan · {displayNumber(availableLogistics + availableProduction)}
                    </option>
                  </select>
                  <small id="stock-out-source-hint">
                    Ketersediaan saat ini untuk {selectedSku} · Step {selectedStep}: Logistik {displayNumber(availableLogistics)} · Produksi {displayNumber(availableProduction)}. Jika satu sumber kurang, pilih Gabungan.
                  </small>
                </div>
              ) : null}
            </div>
          </section>
          <section className="report-panel">
            <div className="panel-header">
              <div className="panel-title">
                <div className="panel-title-icon">
                  <FileText size={18} />
                </div>
                <div>
                  <h3>Detail laporan SKU</h3>
                  <p>
                    {displayDate(selectedDate)}{" "}
                    <span className="bullet">•</span> {displayRows.length} SKU
                    aktif · read-only
                  </p>
                </div>
              </div>
            </div>
            <div className="report-export-bar" id="stock-history">
              <div className="report-export-copy">
                <p className="section-kicker">TARIK DATA EXCEL</p>
                <strong>
                  {historyQuery.isFetching
                    ? "Memuat transaksi dalam rentang..."
                    : `${historyQuery.data?.length ?? 0} transaksi dalam rentang`}
                </strong>
                <small>
                  Rentang tanggal inklusif Asia/Jakarta. Aktivitas di bawah tetap
                  menampilkan tanggal laporan saja.
                </small>
              </div>
              <div className="history-date-field">
                <label htmlFor="history-from">Tanggal mulai</label>
                <Input
                  id="history-from"
                  type="date"
                  value={historyFromDate}
                  onChange={event => setHistoryFromDate(event.target.value)}
                />
              </div>
              <div className="history-date-field">
                <label htmlFor="history-to">Tanggal akhir</label>
                <Input
                  id="history-to"
                  type="date"
                  value={historyToDate}
                  onChange={event => setHistoryToDate(event.target.value)}
                />
              </div>
              <Button
                className="save-button report-export-button"
                onClick={handleExportHistoryExcel}
                disabled={
                  historyQuery.isFetching ||
                  !historyFromDate ||
                  !historyToDate ||
                  historyFromDate > historyToDate
                }
              >
                <FileSpreadsheet size={14} />{" "}
                {historyQuery.isFetching ? "Menyiapkan..." : "Tarik Excel"}
              </Button>
            </div>
            {historyFromDate && historyToDate && historyFromDate > historyToDate ? (
              <div className="history-validation report-export-error">
                <AlertTriangle size={15} /> Tanggal mulai harus sama dengan atau
                sebelum tanggal akhir.
              </div>
            ) : historyQuery.isError ? (
              <div className="history-validation report-export-error">
                <AlertTriangle size={15} /> Riwayat gagal dimuat. Periksa koneksi
                lalu pilih ulang rentang.
              </div>
            ) : null}
            <div className="table-hint">
              <ClipboardList size={14} /> Saldo Awal hanya sisa yang dibawa dari
              hari sebelumnya; Stock In/Out/Reject hanya tanggal ini.
              <span>•</span> TOTAL IN mencakup saldo awal + In hari ini sebelum
              Out/Reject; histori lengkap ada di Excel rentang tanggal.
            </div>
            <div className="table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className="col-sku date-head"
                    >
                      SKU
                    </th>
                    <th
                      colSpan={3}
                      className="group-head opening-head"
                    >
                      SALDO AWAL
                    </th>
                    <th
                      colSpan={3}
                      className="group-head logistics-head"
                    >
                      STOCK LOGISTIK HARI INI
                    </th>
                    <th
                      colSpan={3}
                      className="group-head additional-head"
                    >
                      STOCK IN PRODUKSI HARI INI
                    </th>
                    <th
                      colSpan={3}
                      className="group-head stock-out-head"
                    >
                      STOCK OUT HARI INI
                    </th>
                    <th
                      rowSpan={2}
                      className="col-total total-head"
                    >
                      TOTAL IN
                    </th>
                    <th
                      rowSpan={2}
                      className="col-remaining remaining-head"
                    >
                      SISA
                    </th>
                  </tr>
                  <tr>
                    <th className="number-head opening-head">1.4</th>
                    <th className="number-head opening-head">1.5</th>
                    <th className="number-head opening-head">1.6</th>
                    <th className="number-head logistics-head">1.4</th>
                    <th className="number-head logistics-head">1.5</th>
                    <th className="number-head logistics-head">1.6</th>
                    <th className="number-head additional-head">1.4</th>
                    <th className="number-head additional-head">1.5</th>
                    <th className="number-head additional-head">1.6</th>
                    <th className="number-head stock-out-head">1.4</th>
                    <th className="number-head stock-out-head">1.5</th>
                    <th className="number-head stock-out-head">1.6</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length ? (
                    displayRows.map(row => (
                      <tr key={row.skuOrder}>
                        <td className="sku-cell">
                          <span className="sku-status" />
                          {row.skuName}
                        </td>
                        <td className="calculated-cell opening-cell">
                          {displayTableNumber(numberValue(row.opening14))}
                        </td>
                        <td className="calculated-cell opening-cell">
                          {displayTableNumber(numberValue(row.opening15))}
                        </td>
                        <td className="calculated-cell opening-cell">
                          {displayTableNumber(numberValue(row.opening16))}
                        </td>
                        {INPUT_FIELDS.map(field => (
                          <td key={field} className="readonly-cell">
                            {displayTableNumber(numberValue(row[field]))}
                          </td>
                        ))}
                        <td className="calculated-cell stock-out-cell">
                          {displayTableNumber(numberValue(row.stockOut14))}
                        </td>
                        <td className="calculated-cell stock-out-cell">
                          {displayTableNumber(numberValue(row.stockOut15))}
                        </td>
                        <td className="calculated-cell stock-out-cell">
                          {displayTableNumber(numberValue(row.stockOut16))}
                        </td>
                        <td className="calculated-cell total-cell">
                          {displayTableNumber(rowTotalIn(row))}
                        </td>
                        <td className="calculated-cell remaining-cell">
                          {displayTableNumber(rowRemaining(row))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={15} className="empty-row">
                        Tidak ada saldo awal, pergerakan, atau sisa pada tanggal ini.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="footer-label">
                      TOTAL KESELURUHAN
                    </td>
                    <td className="footer-value opening-cell">
                      {displayTableNumber(reportSummary.opening14)}
                    </td>
                    <td className="footer-value opening-cell">
                      {displayTableNumber(reportSummary.opening15)}
                    </td>
                    <td className="footer-value opening-cell">
                      {displayTableNumber(reportSummary.opening16)}
                    </td>
                    <td colSpan={9} />
                    <td className="footer-value">
                      {displayTableNumber(reportSummary.total)}
                    </td>
                    <td className="footer-value">
                      {displayTableNumber(reportSummary.remaining)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="panel-footer">
              <span>
                <span className="legend-dot green" /> Snapshot tanggal terpilih;
                saldo awal hanya sisa yang masih tersedia.
              </span>
              {reportQuery.isFetching || stockQuery.isFetching ? (
                <span className="syncing">
                  <RefreshCw size={13} /> Memuat data...
                </span>
              ) : reportQuery.isError || stockQuery.isError ? (
                <span className="syncing error">
                  <AlertTriangle size={13} /> Gagal memuat data
                </span>
              ) : (
                <span className="syncing">
                  <CheckCircle2 size={13} /> Data siap
                </span>
              )}
            </div>
          </section>
          <section
            className="transactions-section activity-section"
            id="stock-activity"
          >
            <div className="section-inline-heading">
              <div>
                <p className="section-kicker">DETAIL AKTIVITAS</p>
                <h2>Aktivitas stock</h2>
              </div>
              <span className="live-label">
                <span /> {stockQuery.data?.transactions?.length ?? 0} AKTIVITAS
              </span>
            </div>
            <div className="transactions-table-wrap">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Aktivitas</th>
                    <th>Nama SKU</th>
                    <th>Step</th>
                    <th className="align-right">Qty</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {stockQuery.data?.transactions?.length ? (
                    stockQuery.data.transactions.map(transaction => {
                      const kind = activityKind(
                        transaction.movementType as MovementType,
                        transaction.reason
                      );
                      return (
                        <tr key={transaction.id}>
                          <td className="datetime-cell">
                            {formatDateTime(transaction.movedAt)}
                          </td>
                          <td>
                            <span
                              className={`movement-badge ${kind.className}`}
                            >
                              {kind.label}
                            </span>
                          </td>
                          <td>{transaction.skuName}</td>
                          <td>
                            <span
                              className={`step-badge step-${transaction.step}`}
                            >
                              STEP {transaction.step}
                            </span>
                          </td>
                          <td className="align-right qty-table">
                            {displayNumber(numberValue(transaction.qty))}
                          </td>
                          <td className="reason-cell">{transaction.reason}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-row">
                        <Activity size={15} /> Belum ada aktivitas stock pada
                        tanggal ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="page-footer">
            <span>SCM Logistik</span>
            <span>•</span>
            <span>Operational control center</span>
            <span className="footer-right">
              Semua angka dalam satuan operasional
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
