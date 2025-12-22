"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  runTransaction,
  Timestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { successAlert, errorAlert, confirmAlert } from "@/lib/alert";
import {
  Plus,
  Package,
  Trash2,
  TrendingUp,
  Calendar,
  DollarSign,
  X,
  ArrowUpRight,
  History,
  Filter,
  Search,
  Download,
} from "lucide-react";

/* ================= TYPES ================= */
type Material = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  category?: string;
};

type StockIn = {
  id: string;
  materialId: string;
  materialName: string;
  qty: number;
  price: number;
  total: number;
  date: Timestamp;
  note?: string;
};

/* ================= PAGE ================= */
export default function StockInPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [records, setRecords] = useState<StockIn[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<StockIn[]>([]);

  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

  /* ================= FETCH MATERIALS ================= */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "materials"), (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Material, "id">),
      }));
      setMaterials(data);
      if (!materialId && data.length > 0) setMaterialId(data[0].id);
    });
    return () => unsub();
  }, [materialId]);

  /* ================= FETCH STOCK IN ================= */
  useEffect(() => {
    const q = query(collection(db, "stock_in"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<StockIn, "id">),
      }));
      setRecords(data);
      setFilteredRecords(data);
    });
    return () => unsub();
  }, []);

  /* ================= FILTER RECORDS ================= */
  useEffect(() => {
    let result = records;

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.materialName.toLowerCase().includes(term) ||
          (r.note && r.note.toLowerCase().includes(term)) ||
          r.total.toString().includes(term)
      );
    }

    // Material filter
    if (selectedMaterialFilter !== "all") {
      result = result.filter((r) => r.materialId === selectedMaterialFilter);
    }

    // Date filter (last 7 days, 30 days)
    const now = new Date();
    if (dateFilter === "7days") {
      const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
      result = result.filter((r) => r.date.toDate() >= sevenDaysAgo);
    } else if (dateFilter === "30days") {
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
      result = result.filter((r) => r.date.toDate() >= thirtyDaysAgo);
    }

    setFilteredRecords(result);
  }, [records, searchTerm, selectedMaterialFilter, dateFilter]);

  /* ================= CURRENCY FORMATTING ================= */
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const parseCurrency = (value: string) => {
    return Number(value.replace(/[^0-9]/g, ""));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    const numberValue = Number(value);

    if (value === "") {
      setPrice("");
    } else {
      const formatted = new Intl.NumberFormat("id-ID").format(numberValue);
      setPrice(formatted);
    }
  };

  const selectedMaterial = materials.find((m) => m.id === materialId);

  /* ================= CALCULATE STATS ================= */
  const calculateStats = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecords = records.filter((r) => {
      const recordDate = r.date.toDate();
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() === today.getTime();
    });

    const totalSpent = records.reduce((sum, r) => sum + r.total, 0);
    const todaySpent = todayRecords.reduce((sum, r) => sum + r.total, 0);
    const totalItems = records.reduce((sum, r) => sum + r.qty, 0);

    return { totalSpent, todaySpent, totalItems };
  }, [records]);

  const stats = calculateStats();

  /* ================= SUBMIT STOCK IN ================= */
  const handleSubmit = async () => {
    const numericQty = Number(qty);
    const numericPrice = parseCurrency(price);

    if (!materialId || numericQty <= 0 || numericPrice <= 0) {
      errorAlert("Bahan, qty, dan harga wajib diisi");
      return;
    }

    if (!selectedMaterial) {
      errorAlert("Bahan tidak ditemukan");
      return;
    }

    try {
      setLoading(true);

      await runTransaction(db, async (transaction) => {
        const materialRef = doc(db, "materials", materialId);
        const materialSnap = await transaction.get(materialRef);

        if (!materialSnap.exists()) {
          throw new Error("Bahan tidak ditemukan");
        }

        const currentStock = materialSnap.data().stock || 0;
        const newStock = currentStock + numericQty;

        // update stock
        transaction.update(materialRef, {
          stock: newStock,
          lastRestocked: Timestamp.now(),
        });

        // save stock in record
        const stockInRef = collection(db, "stock_in");
        transaction.set(doc(stockInRef), {
          materialId,
          materialName: selectedMaterial.name,
          qty: numericQty,
          price: numericPrice,
          total: numericQty * numericPrice,
          date: Timestamp.now(),
          note: note.trim() || null,
          previousStock: currentStock,
          newStock,
        });
      });

      successAlert(
        `✅ ${numericQty} ${selectedMaterial.unit} ${selectedMaterial.name} berhasil ditambahkan!`
      );
      resetForm();
    } catch (err: unknown) {
      console.error(err);
      errorAlert((err as Error).message || "Gagal melakukan stock in");
    } finally {
      setLoading(false);
    }
  };

  /* ================= DELETE RECORD ================= */
  const handleDelete = async (r: StockIn) => {
    const ok = await confirmAlert(
      `Hapus transaksi ini? Stok akan dikurangi ${r.qty} ${
        materials.find((m) => m.id === r.materialId)?.unit || ""
      } secara otomatis.`
    );
    if (!ok) return;

    try {
      setLoading(true);

      await runTransaction(db, async (transaction) => {
        // Get current material stock
        const materialRef = doc(db, "materials", r.materialId);
        const materialSnap = await transaction.get(materialRef);

        if (!materialSnap.exists()) {
          throw new Error("Material tidak ditemukan");
        }

        const currentStock = materialSnap.data().stock || 0;
        const newStock = currentStock - r.qty;

        if (newStock < 0) {
          throw new Error("Stok tidak cukup untuk melakukan penghapusan");
        }

        // Update material stock
        transaction.update(materialRef, {
          stock: newStock,
          lastUpdated: Timestamp.now(),
        });

        // Delete stock in record
        const recordRef = doc(db, "stock_in", r.id);
        transaction.delete(recordRef);
      });

      successAlert("Transaksi berhasil dihapus dan stok dikurangi");
    } catch (err: unknown) {
      console.error(err);
      errorAlert((err as Error).message || "Gagal menghapus data");
    } finally {
      setLoading(false);
    }
  };

  /* ================= RESET FORM ================= */
  const resetForm = () => {
    setQty("");
    setPrice("");
    setNote("");
    setShowForm(false);
  };

  /* ================= EXPORT DATA ================= */
  const handleExport = () => {
    const csvData = [
      ["Tanggal", "Bahan", "Qty", "Unit", "Harga/Unit", "Total", "Catatan"],
      ...filteredRecords.map((r) => [
        r.date.toDate().toLocaleDateString(),
        r.materialName,
        r.qty,
        materials.find((m) => m.id === r.materialId)?.unit || "",
        formatCurrency(r.price),
        formatCurrency(r.total),
        r.note || "",
      ]),
    ];

    const csvContent = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-in-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    successAlert("Data berhasil diexport");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      {/* ================= HEADER ================= */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Stock In / Pembelian
              </h1>
              <p className="text-gray-600">Kelola masuknya bahan baku</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg font-medium"
            >
              <Plus className="h-5 w-5" />
              Pembelian Baru
            </button>
          </div>
        </div>

        {/* ================= STATS CARDS ================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Pengeluaran</p>
                <p className="text-2xl font-bold mt-2">
                  {formatCurrency(stats.totalSpent)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Pengeluaran Hari Ini</p>
                <p className="text-2xl font-bold mt-2">
                  {formatCurrency(stats.todaySpent)}
                </p>
              </div>
              <Calendar className="h-8 w-8 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Item Masuk</p>
                <p className="text-2xl font-bold mt-2">
                  {stats.totalItems.toLocaleString()} items
                </p>
              </div>
              <Package className="h-8 w-8 opacity-80" />
            </div>
          </div>
        </div>
      </div>

      {/* ================= FORM SECTION ================= */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-8 animate-fadeIn">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                <ArrowUpRight className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Input Pembelian Baru
              </h2>
            </div>
            <button
              onClick={resetForm}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih Bahan <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={materialId}
                  onChange={(e) => setMaterialId(e.target.value)}
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit}) — Stok: {m.stock}
                    </option>
                  ))}
                </select>
                {selectedMaterial && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-blue-900">
                        Stok saat ini:
                      </span>
                      <span className="text-xl font-bold text-blue-700">
                        {selectedMaterial.stock} {selectedMaterial.unit}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jumlah (Qty) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Masukkan jumlah"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {selectedMaterial?.unit || "unit"}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Harga per Unit <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                    Rp
                  </span>
                  <input
                    type="text"
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-right text-lg font-medium"
                    value={price}
                    onChange={handlePriceChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Pembayaran
                </label>
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl">
                  <div className="text-center">
                    <p className="text-sm text-emerald-700 mb-1">
                      Total yang harus dibayar:
                    </p>
                    <p className="text-3xl font-bold text-emerald-900">
                      {formatCurrency(
                        Number(qty || 0) * parseCurrency(price || "0")
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catatan (Opsional)
                </label>
                <textarea
                  placeholder="Contoh: Beli dari supplier A, diskon 10%, dll."
                  className="w-full border border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all h-32"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Memproses...
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Simpan Pembelian
                </>
              )}
            </button>
            <button
              onClick={resetForm}
              className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ================= FILTER SECTION ================= */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari bahan, catatan..."
                className="w-full border border-gray-300 rounded-xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <select
                className="appearance-none border border-gray-300 rounded-xl px-4 py-3.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                value={selectedMaterialFilter}
                onChange={(e) => setSelectedMaterialFilter(e.target.value)}
              >
                <option value="all">Semua Bahan</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>

            <select
              className="border border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">Semua Waktu</option>
              <option value="7days">7 Hari Terakhir</option>
              <option value="30days">30 Hari Terakhir</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================= RECORDS TABLE ================= */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-gray-700" />
            <h3 className="font-bold text-gray-900">
              Riwayat Pembelian ({filteredRecords.length})
            </h3>
          </div>
          <div className="text-sm text-gray-600">
            Total:{" "}
            {formatCurrency(
              filteredRecords.reduce((sum, r) => sum + r.total, 0)
            )}
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">
              Tidak ada data pembelian
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {searchTerm ||
              selectedMaterialFilter !== "all" ||
              dateFilter !== "all"
                ? "Coba ubah filter pencarian"
                : "Mulai dengan menambahkan pembelian baru"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">
                    Tanggal & Waktu
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">
                    Bahan
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">
                    Stok Sebelum
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">
                    Qty Masuk
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">
                    Stok Sekarang
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">
                    Harga
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">
                    Total
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.map((r) => {
                  const material = materials.find((m) => m.id === r.materialId);

                  const previousStock = material?.stock ?? 0;
                  const newStock = previousStock + r.qty;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 font-medium">
                          {r.date.toDate().toLocaleDateString("id-ID")}
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.date
                            .toDate()
                            .toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {r.materialName}
                        </div>
                        {r.note && (
                          <div
                            className="text-sm text-gray-600 mt-1 line-clamp-1"
                            title={r.note}
                          >
                            📝 {r.note}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700">{previousStock}</span>
                          <span className="text-gray-500 text-sm">
                            {material?.unit}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 rounded-full text-sm font-medium">
                            +{r.qty}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {material?.unit}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 font-medium">
                            {newStock}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {material?.unit}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-700">
                          {formatCurrency(r.price)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">
                          {formatCurrency(r.total)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDelete(r)}
                          className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 hover:from-rose-100 hover:to-rose-200 rounded-lg transition-all"
                          title="Hapus dan kurangi stok"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="text-sm">Hapus</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= SUMMARY ================= */}
      {filteredRecords.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-sm text-blue-700">Total Transaksi</p>
              <p className="text-2xl font-bold text-blue-900">
                {filteredRecords.length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-blue-700">Total Qty Masuk</p>
              <p className="text-2xl font-bold text-blue-900">
                {filteredRecords
                  .reduce((sum, r) => sum + r.qty, 0)
                  .toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-blue-700">Rata-rata Harga</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(
                  filteredRecords.length > 0
                    ? filteredRecords.reduce((sum, r) => sum + r.price, 0) /
                        filteredRecords.length
                    : 0
                )}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-blue-700">Total Pengeluaran</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(
                  filteredRecords.reduce((sum, r) => sum + r.total, 0)
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= GLOBAL STYLES ================= */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .line-clamp-1 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 1;
        }
      `}</style>
    </div>
  );
}
