"use client";

import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { successAlert, errorAlert, confirmAlert } from "@/lib/alert";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  List,
  Filter,
  Upload,
  Download,
  MoreVertical,
  FileSpreadsheet,
  Check,
  AlertCircle,
} from "lucide-react";
import * as XLSX from "xlsx";

type Material = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock?: number;
  createdAt?: Timestamp;
};

type FilterState = {
  status: "all" | "danger" | "warning" | "good";
  unit: string;
  minStock: boolean;
};

export default function StokPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<10 | 25 | 50 | "all">(10);
  const [showItemsPerPageModal, setShowItemsPerPageModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState<string | null>(
    null
  );
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    unit: "all",
    minStock: false,
  });
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);

  /* ================= PAGINATION CALCULATIONS ================= */
  const totalItems = filteredMaterials.length;
  const itemsPerPageNumber = itemsPerPage === "all" ? totalItems : itemsPerPage;
  const totalPages =
    itemsPerPage === "all" ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPageNumber;
  const endIndex = startIndex + itemsPerPageNumber;
  const currentItems = filteredMaterials.slice(startIndex, endIndex);

  /* ================= FETCH DATA ================= */
  useEffect(() => {
    const q = query(collection(db, "materials"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const data: Material[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Material, "id">),
      }));
      setMaterials(data);

      // Extract unique units
      const units = Array.from(new Set(data.map((m) => m.unit))).sort();
      setAvailableUnits(units);
    });

    return () => unsub();
  }, []);

  /* ================= SEARCH & FILTER ================= */
  useEffect(() => {
    let filtered = [...materials];

    // Apply search
    if (searchTerm.trim()) {
      filtered = filtered.filter(
        (material) =>
          material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          material.unit.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (filters.status !== "all") {
      filtered = filtered.filter((material) => {
        const status = getStockStatus(material.stock, material.minStock || 0);
        return status === filters.status;
      });
    }

    // Apply unit filter
    if (filters.unit !== "all") {
      filtered = filtered.filter((material) => material.unit === filters.unit);
    }

    // Apply min stock filter
    if (filters.minStock) {
      filtered = filtered.filter(
        (material) =>
          material.minStock &&
          material.minStock > 0 &&
          material.stock <= material.minStock
      );
    }

    setFilteredMaterials(filtered);
    setCurrentPage(1);
  }, [searchTerm, materials, filters]);

  /* ================= CREATE / UPDATE ================= */
  const handleSubmit = async () => {
    if (!name.trim()) {
      errorAlert("Nama bahan wajib diisi");
      return;
    }

    if (stock < 0 || minStock < 0) {
      errorAlert("Stok tidak boleh negatif");
      return;
    }

    try {
      setModalLoading(true);

      if (editingId) {
        // UPDATE
        await updateDoc(doc(db, "materials", editingId), {
          name: name.trim(),
          unit,
          stock: Number(stock),
          minStock: Number(minStock),
          updatedAt: Timestamp.now(),
        });
        successAlert("Bahan berhasil diperbarui");
      } else {
        // CREATE
        await addDoc(collection(db, "materials"), {
          name: name.trim(),
          unit,
          stock: Number(stock),
          minStock: Number(minStock),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        successAlert("Bahan berhasil ditambahkan");
      }

      resetForm();
      setShowFormModal(false);
    } catch (err) {
      console.error(err);
      errorAlert("Gagal menyimpan data");
    } finally {
      setModalLoading(false);
    }
  };

  /* ================= DELETE ================= */
  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmAlert(`Hapus bahan "${name}"?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "materials", id));
      successAlert("Bahan berhasil dihapus");
    } catch (err) {
      console.error(err);
      errorAlert("Gagal menghapus bahan");
    }
  };

  /* ================= EDIT ================= */
  const handleEdit = (m: Material) => {
    setEditingId(m.id);
    setName(m.name);
    setUnit(m.unit);
    setStock(m.stock);
    setMinStock(m.minStock || 0);
    setShowFormModal(true);
    setShowMobileActions(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setUnit("kg");
    setStock(0);
    setMinStock(0);
  };

  const handleAddNew = () => {
    resetForm();
    setShowFormModal(true);
  };

  const handleCloseModal = () => {
    setShowFormModal(false);
    resetForm();
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
  };

  const handleCloseFilterModal = () => {
    setShowFilterModal(false);
  };

  /* ================= STATS & STATUS ================= */
  const lowStockItems = materials.filter(
    (m) => m.minStock && m.stock <= m.minStock
  ).length;
  const totalStockValue = materials.reduce((sum, m) => sum + m.stock, 0);

  const getStockStatus = (stock: number, minStock: number) => {
    if (minStock && stock <= minStock) return "danger";
    if (minStock && stock < minStock * 2) return "warning";
    return "good";
  };

  /* ================= PAGINATION HANDLERS ================= */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: 10 | 25 | 50 | "all") => {
    setItemsPerPage(value);
    setCurrentPage(1);
    setShowItemsPerPageModal(false);
  };

  /* ================= EXPORT TO EXCEL ================= */
  const handleExportExcel = () => {
    try {
      // Prepare data for export
      const exportData = materials.map((material) => ({
        "Nama Bahan": material.name,
        Satuan: material.unit,
        "Stok Saat Ini": material.stock,
        "Stok Minimum": material.minStock || 0,
        Status:
          getStockStatus(material.stock, material.minStock || 0) === "danger"
            ? "Menipis"
            : getStockStatus(material.stock, material.minStock || 0) ===
              "warning"
            ? "Waspada"
            : "Aman",
        "Terakhir Diperbarui": material.createdAt
          ?.toDate()
          .toLocaleDateString("id-ID"),
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const wscols = [
        { wch: 25 }, // Nama Bahan
        { wch: 10 }, // Satuan
        { wch: 15 }, // Stok Saat Ini
        { wch: 15 }, // Stok Minimum
        { wch: 12 }, // Status
        { wch: 20 }, // Terakhir Diperbarui
      ];
      ws["!cols"] = wscols;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Stok Bahan");

      // Generate and download file
      const fileName = `stok-bahan-${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, fileName);

      successAlert("Data berhasil diexport ke Excel");
    } catch (err) {
      console.error(err);
      errorAlert("Gagal mengexport data");
    }
  };

  /* ================= DOWNLOAD TEMPLATE ================= */
  const handleDownloadTemplate = () => {
    try {
      // Template data
      const templateData = [
        {
          "Nama Bahan": "Beras",
          Satuan: "kg",
          "Stok Saat Ini": 100,
          "Stok Minimum": 20,
        },
        {
          "Nama Bahan": "Minyak Goreng",
          Satuan: "liter",
          "Stok Saat Ini": 50,
          "Stok Minimum": 10,
        },
        {
          "Nama Bahan": "Gula",
          Satuan: "kg",
          "Stok Saat Ini": 30,
          "Stok Minimum": 5,
        },
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(templateData);

      // Add instructions sheet
      const instructions = [
        ["PETUNJUK PENGISIAN:"],
        ["1. Isi data sesuai format kolom"],
        ["2. Nama Bahan: Nama bahan baku (wajib)"],
        ["3. Satuan: kg, liter, pcs, gram, bungkus, karung"],
        ["4. Stok Saat Ini: Angka (wajib, tidak boleh negatif)"],
        ["5. Stok Minimum: Angka (opsional, 0 jika tidak ada)"],
        ["6. Jangan ubah nama kolom"],
        ["7. Hapus contoh data sebelum import"],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(instructions);

      // Set column widths
      const wscols = [{ wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];
      ws["!cols"] = wscols;

      // Add worksheets to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Template Data");
      XLSX.utils.book_append_sheet(wb, ws2, "Petunjuk");

      // Generate and download file
      XLSX.writeFile(wb, "template-import-stok.xlsx");

      successAlert("Template berhasil didownload");
    } catch (err) {
      console.error(err);
      errorAlert("Gagal membuat template");
    }
  };

  type ImportRow = Record<string, unknown>;

  const getString = (row: ImportRow, key: string) => {
    const v = row[key];
    return typeof v === "string" ? v.trim() : "";
  };

  const getNumber = (row: ImportRow, key: string) => {
    const v = row[key];
    return typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  };

  /* ================= IMPORT FROM EXCEL ================= */
  const handleImportExcel = async () => {
    if (!importFile) {
      errorAlert("Pilih file Excel terlebih dahulu");
      return;
    }

    const ok = await confirmAlert(
      "Import data dari Excel? Data yang sudah ada akan diperbarui berdasarkan nama bahan."
    );
    if (!ok) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          let successCount = 0;
          let failedCount = 0;
          const batch = writeBatch(db);

          // Process each row
          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i] as ImportRow;

            const progress = Math.round(((i + 1) / jsonData.length) * 100);
            setImportProgress(progress);

            const name = getString(row, "Nama Bahan");
            const unit = getString(row, "Satuan");
            const stock = getNumber(row, "Stok Saat Ini");
            const minStock = getNumber(row, "Stok Minimum");

            // Validate required fields
            if (!name || !unit) {
              failedCount++;
              continue;
            }

            if (stock < 0 || minStock < 0) {
              failedCount++;
              continue;
            }

            const existingMaterial = materials.find(
              (m) => m.name.toLowerCase() === name.toLowerCase()
            );

            if (existingMaterial) {
              const materialRef = doc(db, "materials", existingMaterial.id);
              batch.update(materialRef, {
                name,
                unit,
                stock,
                minStock,
                updatedAt: Timestamp.now(),
              });
            } else {
              const materialRef = doc(collection(db, "materials"));
              batch.set(materialRef, {
                name,
                unit,
                stock,
                minStock,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
              });
            }

            successCount++;

            if (i % 400 === 0 && i > 0) {
              await batch.commit();
            }
          }

          // Commit remaining documents
          await batch.commit();

          setImportResult({ success: successCount, failed: failedCount });

          if (failedCount === 0) {
            successAlert(`Berhasil mengimport ${successCount} data bahan`);
          } else {
            successAlert(
              `Import selesai: ${successCount} berhasil, ${failedCount} gagal`
            );
          }

          setImportFile(null);
        } catch (err) {
          console.error(err);
          errorAlert("Format file tidak valid");
        } finally {
          setIsImporting(false);
        }
      };

      reader.onerror = () => {
        errorAlert("Gagal membaca file");
        setIsImporting(false);
      };

      reader.readAsBinaryString(importFile);
    } catch (err) {
      console.error(err);
      errorAlert("Gagal memproses file");
      setIsImporting(false);
    }
  };

  /* ================= FILTER HANDLERS ================= */
  const handleFilterChange = (key: keyof FilterState, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      status: "all",
      unit: "all",
      minStock: false,
    });
    setSearchTerm("");
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900">
            Stok Bahan
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5 lg:mt-1">
            Kelola stok bahan baku restoran
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-50 rounded-lg sm:rounded-xl">
          <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
          <span className="text-xs sm:text-sm font-medium text-emerald-700">
            {materials.length} bahan
          </span>
        </div>
      </div>

      {/* ================= STATS CARDS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-gradient-to-r from-slate-50 to-white rounded-lg sm:rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2 sm:mb-3 lg:mb-4">
            <h3 className="text-xs sm:text-sm lg:text-lg font-semibold text-slate-700">
              Total Bahan
            </h3>
            <Package className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-slate-400" />
          </div>
          <p className="text-lg sm:text-xl lg:text-3xl font-bold text-slate-900">
            {materials.length}
          </p>
          <p className="text-[10px] sm:text-xs lg:text-sm text-slate-500 mt-1 sm:mt-2">
            Jenis bahan baku
          </p>
        </div>

        <div className="bg-gradient-to-r from-amber-50 to-white rounded-lg sm:rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 border border-amber-100 shadow-sm">
          <div className="flex items-center justify-between mb-2 sm:mb-3 lg:mb-4">
            <h3 className="text-xs sm:text-sm lg:text-lg font-semibold text-amber-700">
              Stok Menipis
            </h3>
            <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-amber-500" />
          </div>
          <p className="text-lg sm:text-xl lg:text-3xl font-bold text-amber-700">
            {lowStockItems}
          </p>
          <p className="text-[10px] sm:text-xs lg:text-sm text-amber-600 mt-1 sm:mt-2">
            Perlu restok
          </p>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-gradient-to-r from-emerald-50 to-white rounded-lg sm:rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 border border-emerald-100 shadow-sm">
          <div className="flex items-center justify-between mb-2 sm:mb-3 lg:mb-4">
            <h3 className="text-xs sm:text-sm lg:text-lg font-semibold text-emerald-700">
              Total Stok
            </h3>
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-emerald-500" />
          </div>
          <p className="text-lg sm:text-xl lg:text-3xl font-bold text-emerald-700">
            {totalStockValue}
          </p>
          <p className="text-[10px] sm:text-xs lg:text-sm text-emerald-600 mt-1 sm:mt-2">
            Unit tersedia
          </p>
        </div>
      </div>

      {/* ================= SEARCH & ACTIONS ================= */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-auto sm:flex-1 max-w-lg">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <input
            type="text"
            placeholder="Cari bahan..."
            className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 bg-white border border-slate-200 sm:border-2 rounded-lg sm:rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 sm:focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm sm:text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Mobile Action Buttons (Collapsed) */}
          <div className="sm:hidden flex items-center gap-2 flex-1">
            <button
              onClick={handleAddNew}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-slate-900 to-emerald-900 text-white font-semibold rounded-lg hover:shadow transition-all duration-300 flex-1"
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs">Tambah</span>
            </button>

            <button
              onClick={() => setShowItemsPerPageModal(!showItemsPerPageModal)}
              className="flex items-center justify-center p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-colors"
              title="Items per page"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop Action Buttons */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setShowFilterModal(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 border border-slate-200 sm:border-2 text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-lg sm:rounded-xl font-medium transition-all text-sm"
            >
              <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Filter</span>
              {(filters.status !== "all" ||
                filters.unit !== "all" ||
                filters.minStock) && (
                <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
              )}
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 border border-slate-200 sm:border-2 text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-lg sm:rounded-xl font-medium transition-all text-sm"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 border border-slate-200 sm:border-2 text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-lg sm:rounded-xl font-medium transition-all text-sm"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={handleAddNew}
              className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-slate-900 to-emerald-900 text-white font-semibold rounded-lg sm:rounded-xl hover:shadow-lg transition-all duration-300 text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Tambah Bahan</span>
              <span className="sm:hidden">Tambah</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {(filters.status !== "all" ||
        filters.unit !== "all" ||
        filters.minStock) && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-amber-50 rounded-lg sm:rounded-xl border border-amber-200">
          <span className="text-xs font-medium text-amber-800">
            Filter Aktif:
          </span>

          {filters.status !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">
              Status:{" "}
              {filters.status === "danger"
                ? "Menipis"
                : filters.status === "warning"
                ? "Waspada"
                : "Aman"}
              <button
                onClick={() => handleFilterChange("status", "all")}
                className="text-amber-600 hover:text-amber-800"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.unit !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">
              Satuan: {filters.unit}
              <button
                onClick={() => handleFilterChange("unit", "all")}
                className="text-amber-600 hover:text-amber-800"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.minStock && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">
              Stok Menipis
              <button
                onClick={() => handleFilterChange("minStock", false)}
                className="text-amber-600 hover:text-amber-800"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            onClick={handleResetFilters}
            className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900"
          >
            Reset Semua Filter
          </button>
        </div>
      )}

      {/* ================= TABLE & PAGINATION CARD ================= */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl lg:rounded-3xl shadow border sm:shadow-xl border-slate-100 sm:border-white/20 overflow-hidden">
        {/* Table Header with Items Per Page Selector */}
        <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-lg font-semibold text-slate-900">
              Daftar Bahan Baku
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan {startIndex + 1}-{Math.min(endIndex, totalItems)} dari{" "}
              {totalItems} bahan
            </p>
          </div>

          {/* Items Per Page Selector Button (Desktop) */}
          <div className="hidden sm:block relative">
            <button
              onClick={() => setShowItemsPerPageModal(!showItemsPerPageModal)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg sm:rounded-xl text-slate-700 font-medium transition-colors text-sm"
            >
              <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>
                {itemsPerPage === "all" ? "Semua" : `${itemsPerPage}/halaman`}
              </span>
            </button>

            {/* Items Per Page Modal */}
            {showItemsPerPageModal && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowItemsPerPageModal(false)}
                />

                <div className="absolute right-0 top-10 sm:top-12 z-50 w-48 sm:w-64 bg-white rounded-lg sm:rounded-xl shadow-xl border border-slate-200 overflow-hidden">
                  <div className="p-3 sm:p-4 border-b border-slate-100">
                    <h4 className="text-sm sm:text-base font-semibold text-slate-900">
                      Items per Page
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Pilih jumlah item per halaman
                    </p>
                  </div>

                  <div className="py-1 sm:py-2">
                    {[10, 25, 50, "all"].map((option) => (
                      <button
                        key={option}
                        onClick={() =>
                          handleItemsPerPageChange(
                            option as 10 | 25 | 50 | "all"
                          )
                        }
                        className={`w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 text-left transition-colors text-sm ${
                          itemsPerPage === option
                            ? "bg-emerald-50 text-emerald-700"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-medium">
                          {option === "all"
                            ? "Tampilkan Semua"
                            : `${option} items`}
                        </span>
                        {itemsPerPage === option && (
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {/* Desktop Table */}
          <table className="hidden sm:table w-full">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-slate-700">
                  Nama Bahan
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-slate-700">
                  Satuan
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-slate-700">
                  Stok
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-slate-700">
                  Status
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-slate-700">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentItems.map((m) => {
                const status = getStockStatus(m.stock, m.minStock || 0);
                return (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 lg:px-6 py-3">
                      <div className="font-medium text-slate-900 text-sm">
                        {m.name}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-3">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">
                        {m.unit}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-3">
                      <div className="text-base font-semibold text-slate-900">
                        {m.stock}
                      </div>
                      {m.minStock && m.minStock > 0 && (
                        <div className="text-xs text-slate-500">
                          Min: {m.minStock}
                        </div>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-3">
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          status === "danger"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : status === "warning"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            status === "danger"
                              ? "bg-rose-500"
                              : status === "warning"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        ></div>
                        {status === "danger"
                          ? "Menipis"
                          : status === "warning"
                          ? "Waspada"
                          : "Aman"}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(m)}
                          className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-all duration-200"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.name)}
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all duration-200"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-2 p-3">
            {currentItems.map((m) => {
              const status = getStockStatus(m.stock, m.minStock || 0);
              return (
                <div
                  key={m.id}
                  className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm">
                        {m.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                          {m.unit}
                        </span>
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                            status === "danger"
                              ? "bg-rose-50 text-rose-700"
                              : status === "warning"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              status === "danger"
                                ? "bg-rose-500"
                                : status === "warning"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                          ></div>
                          {status === "danger"
                            ? "Menipis"
                            : status === "warning"
                            ? "Waspada"
                            : "Aman"}
                        </div>
                      </div>
                    </div>

                    {/* Mobile Actions Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setShowMobileActions(
                            showMobileActions === m.id ? null : m.id
                          )
                        }
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {showMobileActions === m.id && (
                        <div className="absolute right-0 top-6 z-10 w-32 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                          <button
                            onClick={() => handleEdit(m)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.name)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-lg font-bold text-slate-900">
                        {m.stock}
                      </div>
                      {m.minStock && m.minStock > 0 && (
                        <div className="text-xs text-slate-500">
                          Min: {m.minStock}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {currentItems.length === 0 && (
            <div className="px-3 sm:px-6 py-8 sm:py-12 text-center">
              <div className="flex flex-col items-center justify-center text-slate-400">
                <Package className="w-8 h-8 sm:w-12 sm:h-12 mb-2 sm:mb-3 opacity-40" />
                <p className="text-sm sm:text-lg font-medium text-slate-500">
                  {searchTerm ||
                  filters.status !== "all" ||
                  filters.unit !== "all" ||
                  filters.minStock
                    ? "Bahan tidak ditemukan"
                    : "Belum ada data bahan"}
                </p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  {searchTerm ||
                  filters.status !== "all" ||
                  filters.unit !== "all" ||
                  filters.minStock
                    ? "Coba ubah pencarian atau filter"
                    : "Mulai dengan menambahkan bahan baru"}
                </p>
                <button
                  onClick={handleAddNew}
                  className="mt-3 sm:mt-4 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-slate-900 to-emerald-900 text-white font-semibold rounded-lg sm:rounded-xl hover:shadow transition-all duration-300 text-sm"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-base">
                    Tambah Bahan Pertama
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {itemsPerPage !== "all" && totalPages > 1 && (
          <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
            <div className="text-xs text-slate-500">
              Halaman {currentPage} dari {totalPages}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-0.5">
                {[...Array(totalPages)].map((_, index) => {
                  const pageNumber = index + 1;
                  // Show limited pages on mobile
                  if (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= currentPage - 1 &&
                      pageNumber <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => handlePageChange(pageNumber)}
                        className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                          currentPage === pageNumber
                            ? "bg-gradient-to-r from-slate-900 to-emerald-900 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  }
                  // Show ellipsis for skipped pages on mobile
                  if (
                    (pageNumber === 2 && currentPage > 3) ||
                    (pageNumber === totalPages - 1 &&
                      currentPage < totalPages - 2)
                  ) {
                    return (
                      <span
                        key={pageNumber}
                        className="px-1 text-slate-400 text-xs"
                      >
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= FORM MODAL ================= */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          {/* Modal */}
          <div
            className="bg-white rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-xl w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {editingId ? "Edit Bahan" : "Tambah Bahan"}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  {editingId ? "Perbarui data bahan" : "Tambahkan bahan baru"}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  Nama Bahan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Beras, Minyak, Daging"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-50 border border-slate-200 sm:border-2 rounded-lg sm:rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 sm:focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm sm:text-base"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  Satuan *
                </label>
                <select
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-50 border border-slate-200 sm:border-2 rounded-lg sm:rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 sm:focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm sm:text-base appearance-none"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="kg">Kilogram (kg)</option>
                  <option value="liter">Liter (L)</option>
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="gram">Gram (g)</option>
                  <option value="bungkus">Bungkus</option>
                  <option value="karung">Karung</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                    Stok Saat Ini
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-50 border border-slate-200 sm:border-2 rounded-lg sm:rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 sm:focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm sm:text-base"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                    Stok Minimum
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-50 border border-slate-200 sm:border-2 rounded-lg sm:rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 sm:focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm sm:text-base"
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                  />
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                    Akan muncul peringatan jika stok ≤ ini
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex items-center justify-end gap-2 sm:gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 sm:px-6 py-2 sm:py-3 border border-slate-200 sm:border-2 text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-lg sm:rounded-xl font-medium sm:font-semibold transition-all text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={modalLoading || !name.trim()}
                className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-slate-900 to-emerald-900 hover:from-slate-800 hover:to-emerald-800 text-white font-medium sm:font-semibold rounded-lg sm:rounded-xl transition-all duration-300 shadow hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                {modalLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : editingId ? (
                  <>
                    <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Update</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Simpan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= IMPORT MODAL ================= */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div
            className="bg-white rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-xl w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Import Data Excel
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Import data bahan dari file Excel
                </p>
              </div>
              <button
                onClick={handleCloseImportModal}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Template Download */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                <div className="flex items-start gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900">
                      Download Template
                    </h4>
                    <p className="text-xs text-blue-700 mt-1">
                      Download template Excel untuk mengisi data dengan format
                      yang benar.
                    </p>
                    <button
                      onClick={handleDownloadTemplate}
                      className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Template
                    </button>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Pilih File Excel (.xlsx, .xls)
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg sm:rounded-xl p-4 sm:p-6 text-center hover:border-emerald-500 transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center">
                      <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 mb-2" />
                      <p className="text-sm text-slate-700 mb-1">
                        {importFile
                          ? importFile.name
                          : "Klik untuk upload file"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Drag & drop atau klik untuk memilih file
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Import Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">Mengimport data...</span>
                    <span className="font-medium text-emerald-600">
                      {importProgress}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Import Result */}
              {importResult && !isImporting && (
                <div
                  className={`p-3 sm:p-4 rounded-lg sm:rounded-xl ${
                    importResult.failed === 0
                      ? "bg-emerald-50 border border-emerald-200"
                      : "bg-amber-50 border border-amber-200"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {importResult.failed === 0 ? (
                      <Check className="w-5 h-5 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    )}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {importResult.failed === 0
                          ? "Import Berhasil"
                          : "Import Selesai"}
                      </h4>
                      <p className="text-xs text-slate-700 mt-1">
                        {importResult.success} data berhasil diimport
                        {importResult.failed > 0 &&
                          `, ${importResult.failed} data gagal`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex items-center justify-end gap-2 sm:gap-3">
              <button
                onClick={handleCloseImportModal}
                className="px-4 sm:px-6 py-2 sm:py-3 border border-slate-200 sm:border-2 text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-lg sm:rounded-xl font-medium sm:font-semibold transition-all text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleImportExcel}
                disabled={!importFile || isImporting}
                className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-slate-900 to-emerald-900 hover:from-slate-800 hover:to-emerald-800 text-white font-medium sm:font-semibold rounded-lg sm:rounded-xl transition-all duration-300 shadow hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span>Mengimport...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Import Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= FILTER MODAL ================= */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div
            className="bg-white rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-xl w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Filter Data
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Filter data bahan berdasarkan kriteria
                </p>
              </div>
              <button
                onClick={handleCloseFilterModal}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status Stok
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      value: "all",
                      label: "Semua",
                      color: "bg-slate-100 text-slate-700",
                    },
                    {
                      value: "good",
                      label: "Aman",
                      color: "bg-emerald-100 text-emerald-700",
                    },
                    {
                      value: "warning",
                      label: "Waspada",
                      color: "bg-amber-100 text-amber-700",
                    },
                    {
                      value: "danger",
                      label: "Menipis",
                      color: "bg-rose-100 text-rose-700",
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange("status", option.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filters.status === option.value
                          ? `${option.color} border-2 border-current`
                          : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unit Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Satuan
                </label>
                <select
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-50 border border-slate-200 sm:border-2 rounded-lg sm:rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 sm:focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm sm:text-base appearance-none"
                  value={filters.unit}
                  onChange={(e) => handleFilterChange("unit", e.target.value)}
                >
                  <option value="all">Semua Satuan</option>
                  {availableUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Min Stock Filter */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="minStockFilter"
                  checked={filters.minStock}
                  onChange={(e) =>
                    handleFilterChange("minStock", e.target.checked)
                  }
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <label
                  htmlFor="minStockFilter"
                  className="text-sm text-slate-700"
                >
                  Hanya tampilkan stok yang menipis (≤ stok minimum)
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex items-center justify-between gap-2 sm:gap-3">
              <button
                onClick={handleResetFilters}
                className="px-4 sm:px-6 py-2 sm:py-3 border border-slate-200 sm:border-2 text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-lg sm:rounded-xl font-medium sm:font-semibold transition-all text-sm"
              >
                Reset Filter
              </button>
              <button
                onClick={handleCloseFilterModal}
                className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-slate-900 to-emerald-900 hover:from-slate-800 hover:to-emerald-800 text-white font-medium sm:font-semibold rounded-lg sm:rounded-xl transition-all duration-300 shadow hover:shadow-lg text-sm sm:text-base"
              >
                <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Terapkan Filter</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
