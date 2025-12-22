"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DollarSign,
  Calendar,
  ShoppingBag,
  Package,
  Filter,
  Download,
  BarChart3,
  PieChart,
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  ChevronLeft,
  ChevronRight,
  BarChart4,
  Award,
} from "lucide-react";

/* ================= TYPES ================= */
type Sale = {
  id: string;
  productName: string;
  qty: number;
  price: number;
  total: number;
  date: Timestamp | Date; // Tipe spesifik untuk Firebase
  receiptNumber?: string;
  paymentMethod?: string;
};

type DailyStats = {
  date: string;
  total: number;
  transactions: number;
  items: number;
};

/* ================= PAGE ================= */
export default function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number | "all">(10);
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "all">(
    "day"
  );
  const [showCharts, setShowCharts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  /* ================= FETCH ================= */
  useEffect(() => {
    const q = query(collection(db, "sales"), orderBy("date", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const salesData = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Sale, "id">),
      }));
      setSales(salesData);
      setTimeout(() => setLoading(false), 500);
    });

    return () => unsub();
  }, []);

  /* ================= HELPER: CONVERT TO DATE ================= */
  const toDate = (dateValue: Timestamp | Date | null): Date | null => {
    if (!dateValue) return null;
    
    // Jika sudah Date object
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // Jika Timestamp Firebase
    if (dateValue instanceof Timestamp) {
      return dateValue.toDate();
    }
    
    return null;
  };

  /* ================= FORMAT CURRENCY ================= */
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  /* ================= FILTER LOGIC ================= */
  const filterFunction = useCallback(
    (sale: Sale) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Filter pencarian
      const matchSearch = search
        ? sale.productName.toLowerCase().includes(search.toLowerCase()) ||
          (sale.receiptNumber &&
            sale.receiptNumber.toLowerCase().includes(search.toLowerCase()))
        : true;

      // Filter tanggal spesifik
      const saleDate = toDate(sale.date);
      let matchDate = true;
      
      if (date && saleDate) {
        matchDate = saleDate.toISOString().slice(0, 10) === date;
      }

      // Filter rentang waktu
      let matchTimeRange = true;

      if (!date && timeRange !== "all" && saleDate) {
        switch (timeRange) {
          case "day":
            matchTimeRange = saleDate >= today;
            break;
          case "week":
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            matchTimeRange = saleDate >= weekAgo;
            break;
          case "month":
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            matchTimeRange = saleDate >= monthAgo;
            break;
        }
      }

      // Filter metode pembayaran
      const matchPayment =
        paymentFilter === "all" || sale.paymentMethod === paymentFilter;

      return matchSearch && matchDate && matchTimeRange && matchPayment;
    },
    [search, date, timeRange, paymentFilter]
  );

  const filtered = useMemo(() => {
    return sales.filter(filterFunction);
  }, [sales, filterFunction]);

  /* ================= PAGINATION ================= */
  const totalPages =
    perPage === "all" ? 1 : Math.ceil(filtered.length / perPage);

  const paginated =
    perPage === "all"
      ? filtered
      : filtered.slice(
          (page - 1) * (perPage as number),
          page * (perPage as number)
        );

  /* ================= CALCULATIONS ================= */
  const totalOmzet = useMemo(
    () => filtered.reduce((sum, s) => sum + s.total, 0),
    [filtered]
  );

  const totalItemsSold = useMemo(
    () => filtered.reduce((sum, s) => sum + s.qty, 0),
    [filtered]
  );

  const averageTransaction = useMemo(
    () => (filtered.length > 0 ? totalOmzet / filtered.length : 0),
    [filtered, totalOmzet]
  );

  const topProducts = useMemo(() => {
    const productMap = new Map<string, { qty: number; revenue: number }>();

    filtered.forEach((sale) => {
      const current = productMap.get(sale.productName) || {
        qty: 0,
        revenue: 0,
      };
      productMap.set(sale.productName, {
        qty: current.qty + sale.qty,
        revenue: current.revenue + sale.total,
      });
    });

    return Array.from(productMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filtered]);

  const dailyStats = useMemo(() => {
    const statsMap = new Map<string, DailyStats>();

    filtered.forEach((sale) => {
      const saleDate = toDate(sale.date);
      if (!saleDate) return;

      const dateKey = saleDate.toISOString().slice(0, 10);
      const current = statsMap.get(dateKey) || {
        date: dateKey,
        total: 0,
        transactions: 0,
        items: 0,
      };

      statsMap.set(dateKey, {
        date: dateKey,
        total: current.total + sale.total,
        transactions: current.transactions + 1,
        items: current.items + sale.qty,
      });
    });

    return Array.from(statsMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
  }, [filtered]);

  const paymentStats = useMemo(() => {
    const stats = {
      cash: { count: 0, total: 0 },
      qris: { count: 0, total: 0 },
      card: { count: 0, total: 0 },
      other: { count: 0, total: 0 },
    };

    filtered.forEach((sale) => {
      const method = (sale.paymentMethod || "other") as keyof typeof stats;
      if (method in stats) {
        stats[method].count++;
        stats[method].total += sale.total;
      } else {
        stats.other.count++;
        stats.other.total += sale.total;
      }
    });

    return stats;
  }, [filtered]);

  /* ================= EXPORT DATA ================= */
  const exportToCSV = () => {
    const headers = [
      "Tanggal",
      "No Struk",
      "Menu",
      "Qty",
      "Harga Satuan",
      "Total",
      "Metode Pembayaran",
    ];
    let csvContent = headers.join(",") + "\n";

    filtered.forEach((sale) => {
      const saleDate = toDate(sale.date);
      const dateString = saleDate 
        ? saleDate.toLocaleString("id-ID")
        : "-";
      
      csvContent +=
        [
          `"${dateString}"`,
          `"${sale.receiptNumber || "-"}"`,
          `"${sale.productName}"`,
          sale.qty,
          formatCurrency(sale.price).replace(/[^\d,]/g, ""),
          formatCurrency(sale.total).replace(/[^\d,]/g, ""),
          `"${sale.paymentMethod || "-"}"`,
        ].join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `dashboard-sales-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ================= RESET FILTERS ================= */
  const resetFilters = () => {
    setSearch("");
    setDate("");
    setTimeRange("day");
    setPaymentFilter("all");
    setPage(1);
  };

  // Format tanggal untuk input date
  const todayFormatted = new Date().toISOString().split("T")[0];

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
                Dashboard Penjualan
              </h1>
              <p className="text-gray-600">
                Analisis lengkap performa penjualan bisnis Anda
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCharts(!showCharts)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {showCharts ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {showCharts ? "Sembunyikan Chart" : "Tampilkan Chart"}
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all"
            >
              <Download className="h-4 w-4" />
              Export Data
            </button>
          </div>
        </div>
      </div>

      {/* ================= SUMMARY CARDS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SummaryCard
          title="Total Omzet"
          value={totalOmzet}
          icon={<DollarSign className="h-5 w-5" />}
          color="from-blue-500 to-blue-600"
          bgColor="bg-blue-50"
          iconColor="text-blue-600"
          change={`${filtered.length} transaksi`}
          isCurrency={true}
        />

        <SummaryCard
          title="Item Terjual"
          value={totalItemsSold}
          icon={<Package className="h-5 w-5" />}
          color="from-emerald-500 to-emerald-600"
          bgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          change={
            filtered.length > 0
              ? `${(totalItemsSold / filtered.length).toFixed(1)}/transaksi`
              : "0/transaksi"
          }
          isCurrency={false}
        />

        <SummaryCard
          title="Rata-rata Transaksi"
          value={averageTransaction}
          icon={<ShoppingBag className="h-5 w-5" />}
          color="from-purple-500 to-purple-600"
          bgColor="bg-purple-50"
          iconColor="text-purple-600"
          change={topProducts.length > 0 ? topProducts[0].name : "-"}
          isCurrency={true}
        />

        <SummaryCard
          title="Produk Populer"
          value={topProducts.length > 0 ? topProducts[0].qty : 0}
          icon={<Award className="h-5 w-5" />}
          color="from-amber-500 to-amber-600"
          bgColor="bg-amber-50"
          iconColor="text-amber-600"
          change={
            topProducts.length > 0 ? topProducts[0].name : "Belum ada data"
          }
          isCurrency={false}
        />
      </div>

      {/* ================= FILTER SECTION ================= */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
              <Filter className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900">Filter Data</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari menu atau nomor struk..."
                className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="date"
                max={todayFormatted}
                className="border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="flex bg-gray-100 rounded-lg p-1">
              {(["day", "week", "month", "all"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    setTimeRange(range);
                    setDate("");
                    setPage(1);
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
          </div>
        </div>

        {/* ================= SECONDARY FILTERS ================= */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Metode Pembayaran:</span>
            <div className="flex gap-1">
              {["all", "cash", "qris", "card"].map((method) => (
                <button
                  key={method}
                  onClick={() => {
                    setPaymentFilter(method);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    paymentFilter === method
                      ? method === "cash"
                        ? "bg-blue-100 text-blue-700"
                        : method === "qris"
                        ? "bg-emerald-100 text-emerald-700"
                        : method === "card"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {method === "all"
                    ? "Semua"
                    : method === "qris"
                    ? "QRIS"
                    : method.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <select
              className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              value={perPage}
              onChange={(e) => {
                const v =
                  e.target.value === "all" ? "all" : Number(e.target.value);
                setPerPage(v);
                setPage(1);
              }}
            >
              <option value={10}>10 items</option>
              <option value={25}>25 items</option>
              <option value={50}>50 items</option>
              <option value={100}>100 items</option>
              <option value="all">Semua</option>
            </select>
          </div>

          <button
            onClick={resetFilters}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors ml-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Reset Filter
          </button>
        </div>
      </div>

      {/* ================= CHARTS SECTION ================= */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Products Chart */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg">
                  <Award className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-bold text-gray-900">Produk Terlaris</h3>
              </div>
              <span className="text-sm text-gray-500">Top 5</span>
            </div>

            <div className="space-y-4">
              {topProducts.map((product, index) => {
                const maxRevenue = Math.max(
                  ...topProducts.map((p) => p.revenue)
                );
                const percentage =
                  maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0;

                return (
                  <div key={product.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 text-sm font-bold">
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-900 truncate">
                          {product.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">
                          {formatCurrency(product.revenue)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {product.qty} terjual
                        </div>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}

              {topProducts.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-3">Belum ada data produk</div>
                  <p className="text-sm text-gray-500">
                    Mulai lakukan penjualan untuk melihat statistik
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Methods Chart */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                  <PieChart className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="font-bold text-gray-900">Metode Pembayaran</h3>
              </div>
              <span className="text-sm text-gray-500">Distribusi</span>
            </div>

            <div className="space-y-4">
              {Object.entries(paymentStats).map(([method, stats]) => {
                if (stats.count === 0) return null;

                const totalTransactions = Object.values(paymentStats).reduce(
                  (sum, s) => sum + s.count,
                  0
                );
                const percentage =
                  totalTransactions > 0
                    ? (stats.count / totalTransactions) * 100
                    : 0;

                const colorClass =
                  method === "cash"
                    ? "from-blue-400 to-blue-500"
                    : method === "qris"
                    ? "from-emerald-400 to-emerald-500"
                    : method === "card"
                    ? "from-purple-400 to-purple-500"
                    : "from-gray-400 to-gray-500";

                const label =
                  method === "qris"
                    ? "QRIS"
                    : method === "other"
                    ? "Lainnya"
                    : method.toUpperCase();

                return (
                  <div key={method} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full bg-gradient-to-r ${colorClass}`}
                        ></div>
                        <span className="font-medium text-gray-900">
                          {label}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">
                          {stats.count} transaksi
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(stats.total)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${colorClass} rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-600 w-10 text-right">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}

              {Object.values(paymentStats).every((s) => s.count === 0) && (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-3">
                    Belum ada data pembayaran
                  </div>
                  <p className="text-sm text-gray-500">
                    Mulai lakukan transaksi untuk melihat statistik
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= DAILY STATS ================= */}
      {showCharts && dailyStats.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                <BarChart4 className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900">
                Performa 7 Hari Terakhir
              </h3>
            </div>
            <span className="text-sm text-gray-500">
              Rata-rata:{" "}
              {formatCurrency(
                dailyStats.reduce((sum, day) => sum + day.total, 0) /
                  dailyStats.length
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {dailyStats.map((day) => {
              const maxTotal = Math.max(...dailyStats.map((d) => d.total));
              const heightPercentage =
                maxTotal > 0 ? (day.total / maxTotal) * 100 : 0;
              const date = new Date(day.date);
              const dayName = date.toLocaleDateString("id-ID", {
                weekday: "short",
              });
              const dayNumber = date.getDate();

              return (
                <div key={day.date} className="flex flex-col items-center">
                  <div className="text-center mb-2">
                    <div className="text-sm font-medium text-gray-900">
                      {dayName}
                    </div>
                    <div className="text-xs text-gray-500">{dayNumber}</div>
                  </div>

                  <div className="relative flex-1 w-full flex flex-col justify-end">
                    <div className="relative h-32 bg-gradient-to-t from-gray-100 to-gray-50 rounded-lg overflow-hidden">
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400 transition-all duration-500"
                        style={{ height: `${heightPercentage}%` }}
                      ></div>
                    </div>

                    <div className="text-center mt-2">
                      <div className="font-bold text-gray-900 text-sm">
                        {formatCurrency(day.total)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {day.transactions} transaksi
                      </div>
                      <div className="text-xs text-gray-500">
                        {day.items} item
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= SALES TABLE ================= */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="font-bold text-gray-900">Detail Penjualan</h3>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                {filtered.length} transaksi
              </span>
            </div>

            <div className="text-sm text-gray-600">
              Menampilkan {paginated.length} dari {filtered.length} data
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 text-sm font-semibold text-gray-600">
                  Tanggal
                </th>
                <th className="text-left py-3 px-6 text-sm font-semibold text-gray-600">
                  No Struk
                </th>
                <th className="text-left py-3 px-6 text-sm font-semibold text-gray-600">
                  Menu
                </th>
                <th className="text-left py-3 px-6 text-sm font-semibold text-gray-600">
                  Qty
                </th>
                <th className="text-left py-3 px-6 text-sm font-semibold text-gray-600">
                  Harga
                </th>
                <th className="text-left py-3 px-6 text-sm font-semibold text-gray-600">
                  Total
                </th>
                <th className="text-left py-3 px-6 text-sm font-semibold text-gray-600">
                  Metode
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginated.map((sale) => {
                const saleDate = toDate(sale.date);
                
                return (
                  <tr
                    key={sale.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-6">
                      <div className="text-sm font-medium text-gray-900">
                        {saleDate 
                          ? saleDate.toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {saleDate 
                          ? saleDate.toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                        {sale.receiptNumber || "-"}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <div className="font-medium text-gray-900">
                        {sale.productName}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                        {sale.qty}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-gray-900">
                      {formatCurrency(sale.price)}
                    </td>
                    <td className="py-3 px-6">
                      <div className="font-bold text-emerald-600">
                        {formatCurrency(sale.total)}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sale.paymentMethod === "cash"
                            ? "bg-blue-100 text-blue-800"
                            : sale.paymentMethod === "qris"
                            ? "bg-emerald-100 text-emerald-800"
                            : sale.paymentMethod === "card"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {sale.paymentMethod
                          ? sale.paymentMethod.toUpperCase()
                          : "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {paginated.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-3">Tidak ada data penjualan</div>
              <p className="text-sm text-gray-500">
                {search || date || paymentFilter !== "all"
                  ? "Coba ubah filter pencarian Anda"
                  : "Mulai lakukan transaksi untuk melihat data"}
              </p>
            </div>
          )}
        </div>

        {/* ================= PAGINATION ================= */}
        {perPage !== "all" && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Halaman {page} dari {totalPages} • Total {filtered.length} data
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let pageNumber: number;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (page <= 3) {
                    pageNumber = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = page - 2 + i;
                  }

                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setPage(pageNumber)}
                      className={`w-10 h-10 rounded-lg font-medium transition-all ${
                        page === pageNumber
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
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
  isCurrency = true,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  iconColor: string;
  change?: string;
  isCurrency?: boolean;
}) {
  const displayValue = isCurrency
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(value)
    : value.toLocaleString("id-ID");

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
        {displayValue}
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