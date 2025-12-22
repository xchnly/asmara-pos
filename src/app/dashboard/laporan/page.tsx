"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  PlusCircle,
  Download,
  Filter,
  BarChart3,
  DollarSign,
  ShoppingBag,
  Package,
  RefreshCw,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  X,
  Save,
  AlertCircle,
} from "lucide-react";
import { successAlert, errorAlert, confirmAlert } from "@/lib/alert";

/* ================= TYPES ================= */
type Sale = {
  id: string;
  total: number;
  date: Date | Timestamp;
  receiptNumber?: string;
  paymentMethod?: string;
  productName?: string;
};

type StockIn = {
  id: string;
  total: number;
  date: Date | Timestamp;
  supplier?: string;
  note?: string;
  productName?: string;
};

type Capital = {
  id: string;
  amount: number;
  date: Date | Timestamp;
  note?: string;
  type?: "initial" | "additional";
};

type EditModal = {
  id: string;
  amount: string;
  note: string;
  originalAmount: number;
  originalNote: string;
};

type TransactionData = Sale | StockIn;
type ColorVariant = "emerald" | "rose" | "blue" | "gray";

/* ================= PAGE ================= */
export default function LaporanKeuanganPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockIns, setStockIns] = useState<StockIn[]>([]);
  const [capitals, setCapitals] = useState<Capital[]>([]);
  const [date, setDate] = useState<string>("");
  const [modalInput, setModalInput] = useState<string>("");
  const [modalNote, setModalNote] = useState<string>("");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "all">(
    "day"
  );
  const [showDetails, setShowDetails] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingModal, setEditingModal] = useState<EditModal | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    let salesReady = false;
    let stockReady = false;
    let capitalReady = false;

    const checkDone = () => {
      if (salesReady && stockReady && capitalReady) {
        setLoading(false);
      }
    };

    const unsubSales = onSnapshot(
      query(collection(db, "sales"), orderBy("date", "desc")),
      (snap) => {
        const salesData = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Sale[];
        setSales(salesData);
        salesReady = true;
        checkDone();
      }
    );

    const unsubStock = onSnapshot(
      query(collection(db, "stock_in"), orderBy("date", "desc")),
      (snap) => {
        const stockData = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as StockIn[];
        setStockIns(stockData);
        stockReady = true;
        checkDone();
      }
    );

    const unsubCapital = onSnapshot(
      query(collection(db, "capital"), orderBy("date", "desc")),
      (snap) => {
        const capitalData = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Capital[];
        setCapitals(capitalData);
        capitalReady = true;
        checkDone();
      }
    );

    return () => {
      unsubSales();
      unsubStock();
      unsubCapital();
    };
  }, []);

  /* ================= FORMAT CURRENCY ================= */
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatInputCurrency = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    if (numericValue === "") return "";
    const numberValue = parseInt(numericValue, 10);
    return new Intl.NumberFormat("id-ID").format(numberValue);
  };

  const parseCurrency = (value: string) => {
    return Number(value.replace(/[^0-9]/g, ""));
  };

  const handleModalInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputCurrency(e.target.value);
    setModalInput(formatted);
  };

  const handleEditAmountChange = (value: string) => {
    if (!editingModal) return;
    const formatted = formatInputCurrency(value);
    setEditingModal({
      ...editingModal,
      amount: formatted,
    });
  };

  /* ================= DATE HELPER ================= */
  const convertToDate = (dateValue: Date | Timestamp): Date => {
    if (dateValue instanceof Timestamp) {
      return dateValue.toDate();
    }
    return dateValue as Date;
  };

  const formatDateDisplay = (dateValue: Date | Timestamp): string => {
    const date = convertToDate(dateValue);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateOnly = (dateValue: Date | Timestamp): string => {
    const date = convertToDate(dateValue);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTimeOnly = (dateValue: Date | Timestamp): string => {
    const date = convertToDate(dateValue);
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /* ================= FILTER LOGIC ================= */
  const filterByDateRange = useMemo(() => {
    return <T extends { date: Date | Timestamp }>(arr: T[]): T[] => {
      if (!date && timeRange === "all") return arr;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      return arr.filter((item) => {
        const itemDate = convertToDate(item.date);

        if (date) {
          return itemDate.toISOString().slice(0, 10) === date;
        }

        switch (timeRange) {
          case "day":
            return itemDate >= today;

          case "week": {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return itemDate >= weekAgo;
          }

          case "month": {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return itemDate >= monthAgo;
          }

          default:
            return true;
        }
      });
    };
  }, [date, timeRange]);

  const filteredSales = useMemo(
    () => filterByDateRange(sales),
    [filterByDateRange, sales]
  );

  const filteredStockIns = useMemo(
    () => filterByDateRange(stockIns),
    [filterByDateRange, stockIns]
  );

  const filteredCapitals = useMemo(
    () => filterByDateRange(capitals),
    [filterByDateRange, capitals]
  );

  /* ================= CALCULATION ================= */
  const totalModal = useMemo(
    () => capitals.reduce((sum, c) => sum + c.amount, 0),
    [capitals]
  );

  const pemasukan = useMemo(
    () => filteredSales.reduce((sum, s) => sum + s.total, 0),
    [filteredSales]
  );

  const pengeluaran = useMemo(
    () => filteredStockIns.reduce((sum, s) => sum + s.total, 0),
    [filteredStockIns]
  );

  const tambahanModal = useMemo(
    () => filteredCapitals.reduce((sum, c) => sum + c.amount, 0),
    [filteredCapitals]
  );

  const saldoAkhir = totalModal + pemasukan - pengeluaran;
  const labaRugi = pemasukan - pengeluaran;
  const persentaseLaba =
    pengeluaran > 0 ? (labaRugi / pengeluaran) * 100 : pemasukan > 0 ? 100 : 0;

  /* ================= MODAL OPERATIONS ================= */
  const handleAddModal = async () => {
    const amount = parseCurrency(modalInput);
    if (amount <= 0) {
      errorAlert("Masukkan jumlah modal yang valid");
      return;
    }

    try {
      await addDoc(collection(db, "capital"), {
        amount: amount,
        date: Timestamp.now(),
        note: modalNote || "Tambahan Modal",
        type: "additional",
      });

      successAlert(
        `Modal sebesar ${formatCurrency(amount)} berhasil ditambahkan`
      );
      setModalInput("");
      setModalNote("");
    } catch (error) {
      errorAlert("Gagal menambahkan modal");
      console.error(error);
    }
  };

  const startEditModal = (capital: Capital) => {
    setEditingModal({
      id: capital.id,
      amount: formatInputCurrency(capital.amount.toString()),
      note: capital.note || "",
      originalAmount: capital.amount,
      originalNote: capital.note || "",
    });
  };

  const cancelEditModal = () => {
    setEditingModal(null);
  };

  const handleEditModal = async () => {
    if (!editingModal) return;

    const amount = parseCurrency(editingModal.amount);
    if (amount <= 0) {
      errorAlert("Jumlah modal tidak valid");
      return;
    }

    try {
      await updateDoc(doc(db, "capital", editingModal.id), {
        amount: amount,
        note: editingModal.note.trim() || null,
        updatedAt: Timestamp.now(),
      });

      successAlert("Modal berhasil diperbarui");
      setEditingModal(null);
    } catch (error) {
      errorAlert("Gagal memperbarui modal");
      console.error(error);
    }
  };

  const confirmDeleteModal = async (id: string) => {
    const ok = await confirmAlert(
      "Apakah Anda yakin ingin menghapus modal ini?\n" +
        "Tindakan ini tidak dapat dikembalikan."
    );

    if (ok) {
      handleDeleteModal(id);
    }
  };

  const handleDeleteModal = async (id: string) => {
    try {
      await deleteDoc(doc(db, "capital", id));
      successAlert("Modal berhasil dihapus");
      setShowDeleteConfirm(null);
    } catch (error) {
      errorAlert("Gagal menghapus modal");
      console.error(error);
    }
  };

  /* ================= EXPORT DATA ================= */
  const exportToCSV = () => {
    const headers = ["Tanggal", "Kategori", "Keterangan", "Jumlah", "Saldo"];
    let csvContent = headers.join(",") + "\n";

    const allTransactions = [
      ...filteredSales.map((s) => ({
        date: formatDateDisplay(s.date),
        category: "Pemasukan" as const,
        note: s.receiptNumber ? `Transaksi ${s.receiptNumber}` : "Penjualan",
        amount: s.total,
        type: "in" as const,
      })),
      ...filteredStockIns.map((s) => ({
        date: formatDateDisplay(s.date),
        category: "Pengeluaran" as const,
        note: s.note || s.supplier || "Pembelian Stok",
        amount: s.total,
        type: "out" as const,
      })),
      ...filteredCapitals.map((c) => ({
        date: formatDateDisplay(c.date),
        category: "Modal" as const,
        note: c.note || "Modal",
        amount: c.amount,
        type: "in" as const,
      })),
    ].sort((a, b) => {
      const dateA = new Date(
        a.date.split(",")[0].split("/").reverse().join("-")
      );
      const dateB = new Date(
        b.date.split(",")[0].split("/").reverse().join("-")
      );
      return dateB.getTime() - dateA.getTime();
    });

    let runningBalance = totalModal;

    allTransactions.forEach((transaction) => {
      if (transaction.type === "in") {
        runningBalance += transaction.amount;
      } else {
        runningBalance -= transaction.amount;
      }

      csvContent +=
        [
          `"${transaction.date}"`,
          `"${transaction.category}"`,
          `"${transaction.note}"`,
          formatCurrency(transaction.amount).replace(/[^\d,]/g, ""),
          formatCurrency(runningBalance).replace(/[^\d,]/g, ""),
        ].join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `laporan-keuangan-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    successAlert("Data berhasil diekspor ke CSV");
  };

  /* ================= RESET FILTER ================= */
  const resetFilter = () => {
    setDate("");
    setTimeRange("day");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      {/* ================= HEADER ================= */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Laporan Keuangan
              </h1>
              <p className="text-gray-600">
                Monitor kesehatan keuangan bisnis Anda
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {showDetails ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {showDetails ? "Sembunyikan Detail" : "Tampilkan Detail"}
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* ================= ADD MODAL SECTION ================= */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg">
            <PlusCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Tambah Modal / Investasi
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jumlah Modal
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                Rp
              </span>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                placeholder="0"
                value={modalInput}
                onChange={handleModalInputChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Keterangan (Opsional)
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Contoh: Modal tambahan"
              value={modalNote}
              onChange={(e) => setModalNote(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Total Modal Saat Ini:{" "}
            <span className="font-bold text-gray-900">
              {formatCurrency(totalModal)}
            </span>
          </div>
          <button
            onClick={handleAddModal}
            disabled={loading || !modalInput || parseCurrency(modalInput) <= 0}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Tambah Modal
          </button>
        </div>
      </div>

      {/* ================= FILTER SECTION ================= */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
              <Filter className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900">Filter Laporan</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="date"
                className="border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="flex bg-gray-100 rounded-lg p-1">
              {(["day", "week", "month", "all"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    setTimeRange(range);
                    setDate("");
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    timeRange === range
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {range === "day" && "Hari Ini"}
                  {range === "week" && "7 Hari"}
                  {range === "month" && "30 Hari"}
                  {range === "all" && "Semua"}
                </button>
              ))}
            </div>

            <button
              onClick={resetFilter}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ================= SUMMARY CARDS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SummaryCard
          title="Total Modal"
          value={totalModal}
          icon={<Wallet className="h-5 w-5" />}
          color="from-blue-500 to-blue-600"
          bgColor="bg-blue-50"
          iconColor="text-blue-600"
        />

        <SummaryCard
          title="Pemasukan"
          value={pemasukan}
          icon={<TrendingUp className="h-5 w-5" />}
          color="from-emerald-500 to-emerald-600"
          bgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          change={
            tambahanModal > 0
              ? `+${formatCurrency(tambahanModal)} modal`
              : undefined
          }
        />

        <SummaryCard
          title="Pengeluaran"
          value={pengeluaran}
          icon={<TrendingDown className="h-5 w-5" />}
          color="from-rose-500 to-rose-600"
          bgColor="bg-rose-50"
          iconColor="text-rose-600"
        />

        <SummaryCard
          title={labaRugi >= 0 ? "Laba Bersih" : "Rugi"}
          value={labaRugi}
          icon={<DollarSign className="h-5 w-5" />}
          color={
            labaRugi >= 0
              ? "from-emerald-500 to-emerald-600"
              : "from-rose-500 to-rose-600"
          }
          bgColor={labaRugi >= 0 ? "bg-emerald-50" : "bg-rose-50"}
          iconColor={labaRugi >= 0 ? "text-emerald-600" : "text-rose-600"}
          change={
            persentaseLaba !== 0 ? `${persentaseLaba.toFixed(1)}%` : undefined
          }
        />
      </div>

      {/* ================= FINAL BALANCE ================= */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div className="text-white mb-4 md:mb-0">
            <p className="text-sm opacity-90">Saldo Akhir</p>
            <h2 className="text-3xl md:text-4xl font-bold mt-1">
              {formatCurrency(saldoAkhir)}
            </h2>
            <p className="text-sm opacity-90 mt-2">
              {date
                ? `Periode: ${new Date(date).toLocaleDateString("id-ID", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}`
                : timeRange === "day"
                ? "Hari Ini"
                : timeRange === "week"
                ? "7 Hari Terakhir"
                : timeRange === "month"
                ? "30 Hari Terakhir"
                : "Semua Periode"}
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-sm text-white/80">Transaksi</p>
                <p className="text-xl font-bold text-white">
                  {filteredSales.length + filteredStockIns.length}
                </p>
              </div>
              <div className="h-8 w-px bg-white/30"></div>
              <div className="text-center">
                <p className="text-sm text-white/80">Rata-rata Harian</p>
                <p className="text-xl font-bold text-white">
                  {formatCurrency(
                    pemasukan /
                      (timeRange === "day"
                        ? 1
                        : timeRange === "week"
                        ? 7
                        : timeRange === "month"
                        ? 30
                        : 1)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= DETAIL TABLES ================= */}
      {showDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TransactionTable
            title="Pemasukan"
            data={filteredSales}
            type="in"
            icon={<ShoppingBag className="h-4 w-4" />}
            color="emerald"
            formatDateOnly={formatDateOnly}
            formatTimeOnly={formatTimeOnly}
          />

          <TransactionTable
            title="Pengeluaran"
            data={filteredStockIns}
            type="out"
            icon={<Package className="h-4 w-4" />}
            color="rose"
            formatDateOnly={formatDateOnly}
            formatTimeOnly={formatTimeOnly}
          />
        </div>
      )}

      {/* ================= MODAL HISTORY WITH EDIT/DELETE ================= */}
      {showDetails && filteredCapitals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Riwayat Modal</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {filteredCapitals.length} entri
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Tanggal
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Keterangan
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Jumlah
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Tipe
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCapitals.map((capital) => {
                  const isEditing = editingModal?.id === capital.id;

                  return (
                    <tr
                      key={capital.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        {formatDateDisplay(capital.date)}
                      </td>

                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingModal.note}
                            onChange={(e) =>
                              setEditingModal({
                                ...editingModal,
                                note: e.target.value,
                              })
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Keterangan"
                          />
                        ) : (
                          <span className="font-medium">
                            {capital.note || "Modal"}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                              Rp
                            </span>
                            <input
                              type="text"
                              value={editingModal.amount}
                              onChange={(e) =>
                                handleEditAmountChange(e.target.value)
                              }
                              className="w-full border border-gray-300 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                              placeholder="0"
                            />
                          </div>
                        ) : (
                          <span className="font-medium text-blue-600">
                            {formatCurrency(capital.amount)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            capital.type === "initial"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {capital.type === "initial"
                            ? "Modal Awal"
                            : "Tambahan Modal"}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={handleEditModal}
                                className="p-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all"
                                title="Simpan"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelEditModal}
                                className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                                title="Batal"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditModal(capital)}
                                className="p-1.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-600 rounded-lg hover:from-blue-100 hover:to-blue-200 transition-all"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(capital.id)}
                                className="p-1.5 bg-gradient-to-r from-rose-50 to-rose-100 text-rose-600 rounded-lg hover:from-rose-100 hover:to-rose-200 transition-all"
                                title="Hapus"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredCapitals.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-3">Tidak ada riwayat modal</div>
              <p className="text-sm text-gray-500">
                Tambahkan modal terlebih dahulu
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================= DELETE CONFIRMATION MODAL ================= */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-r from-rose-50 to-rose-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-rose-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Konfirmasi Hapus
                </h3>
              </div>

              <p className="text-gray-600 mb-6">
                Apakah Anda yakin ingin menghapus modal ini? Tindakan ini tidak
                dapat dikembalikan.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => confirmDeleteModal(showDeleteConfirm)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl font-medium hover:from-rose-600 hover:to-rose-700 transition-all"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= COMPONENTS ================= */

function SummaryCard({
  title,
  value,
  icon,
  color,
  bgColor,
  iconColor,
  change,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  iconColor: string;
  change?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 ${bgColor} rounded-xl`}>
          <div className={iconColor}>{icon}</div>
        </div>
        {change && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              value >= 0
                ? "bg-emerald-100 text-emerald-800"
                : "bg-rose-100 text-rose-800"
            }`}
          >
            {change}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <h3
        className={`text-2xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}
      >
        {new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
        }).format(value)}
      </h3>
      <div className="flex items-center gap-1 mt-3">
        <div className={`h-2 flex-1 rounded-full ${bgColor}`}>
          <div
            className={`h-full rounded-full bg-gradient-to-r ${color}`}
            style={{ width: `${Math.min(100, Math.abs(value) / 1000000)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

function TransactionTable({
  title,
  data,
  type,
  icon,
  color = "gray",
  formatDateOnly,
  formatTimeOnly,
}: {
  title: string;
  data: TransactionData[];
  type: "in" | "out";
  icon: React.ReactNode;
  color: ColorVariant;
  formatDateOnly: (date: Date | Timestamp) => string;
  formatTimeOnly: (date: Date | Timestamp) => string;
}) {
  const colorClasses = {
    emerald: {
      bg: "bg-emerald-50",
      icon: "text-emerald-600",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
    rose: {
      bg: "bg-rose-50",
      icon: "text-rose-600",
      text: "text-rose-700",
      border: "border-rose-200",
    },
    blue: {
      bg: "bg-blue-50",
      icon: "text-blue-600",
      text: "text-blue-700",
      border: "border-blue-200",
    },
    gray: {
      bg: "bg-gray-50",
      icon: "text-gray-600",
      text: "text-gray-700",
      border: "border-gray-200",
    },
  };

  const colors =
    colorClasses[color as keyof typeof colorClasses] || colorClasses.gray;

  return (
    <div
      className={`bg-white rounded-2xl shadow-xl border ${colors.border} overflow-hidden`}
    >
      <div className={`${colors.bg} px-6 py-4 border-b ${colors.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colors.bg}`}>
              <div className={colors.icon}>{icon}</div>
            </div>
            <h3 className="font-bold text-gray-900">{title}</h3>
          </div>
          <span className="px-3 py-1 bg-white rounded-full text-sm font-medium border">
            {data.length} transaksi
          </span>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[400px]">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-6 text-sm font-semibold text-gray-600">
                Tanggal
              </th>
              <th className="text-left py-3 px-6 text-sm font-semibold text-gray-600">
                Keterangan
              </th>
              <th className="text-left py-3 px-6 text-sm font-semibold text-gray-600">
                Metode
              </th>
              <th className="text-right py-3 px-6 text-sm font-semibold text-gray-600">
                Jumlah
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-6">
                  <div className="text-sm text-gray-900">
                    {formatDateOnly(item.date)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimeOnly(item.date)}
                  </div>
                </td>
                <td className="py-3 px-6">
                  <div className="font-medium text-gray-900">
                    {"receiptNumber" in item && item.receiptNumber
                      ? `#${item.receiptNumber}`
                      : "supplier" in item && item.supplier
                      ? item.supplier
                      : "note" in item && item.note
                      ? item.note
                      : title}
                  </div>
                  {item.productName && (
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                      {item.productName}
                    </div>
                  )}
                </td>
                <td className="py-3 px-6">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      "paymentMethod" in item && item.paymentMethod === "cash"
                        ? "bg-blue-100 text-blue-800"
                        : "paymentMethod" in item &&
                          item.paymentMethod === "qris"
                        ? "bg-emerald-100 text-emerald-800"
                        : "paymentMethod" in item &&
                          item.paymentMethod === "card"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {"paymentMethod" in item && item.paymentMethod
                      ? item.paymentMethod.toUpperCase()
                      : "-"}
                  </span>
                </td>
                <td className="py-3 px-6 text-right">
                  <div
                    className={`font-bold ${
                      type === "in" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {type === "in" ? "+" : "-"}{" "}
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                    }).format(item.total)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-3">Tidak ada data transaksi</div>
            <p className="text-sm text-gray-500">
              Belum ada {title.toLowerCase()} pada periode ini
            </p>
          </div>
        )}
      </div>

      {data.length > 0 && (
        <div className={`border-t ${colors.border} px-6 py-4`}>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total {title}:</span>
            <span
              className={`font-bold text-lg ${
                type === "in" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {type === "in" ? "+" : "-"}{" "}
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
              }).format(data.reduce((sum, item) => sum + item.total, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
