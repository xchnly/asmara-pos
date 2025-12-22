"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { successAlert, errorAlert, confirmAlert } from "@/lib/alert";
import {
  Pencil,
  Trash2,
  Plus,
  Package,
  ChefHat,
  X,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";

/* ================= TYPES ================= */
type Material = {
  id: string;
  name: string;
  unit: string;
  stock?: number;
};

type BOMItem = {
  materialId: string;
  qty: number;
  materialName?: string;
  unit?: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  bom: BOMItem[];
  isActive: boolean;
  createdAt?: Timestamp;
  totalCost?: number;
  profitMargin?: number;
};

/* ================= PAGE ================= */
export default function MenuPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>("");
  const [bom, setBom] = useState<BOMItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [showBomDetails, setShowBomDetails] = useState<string | null>(null);

  /* ================= FETCH MATERIALS ================= */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "materials"), (snap) => {
      const materialsData = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Material, "id">),
      }));
      setMaterials(materialsData);
    });
    return () => unsub();
  }, []);

  /* ================= FETCH PRODUCTS ================= */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      const productsData = snap.docs.map((d) => {
        const data = d.data() as Omit<Product, "id">;
        return {
          id: d.id,
          ...data,
        };
      });
      setProducts(productsData);
      setFilteredProducts(productsData);
    });
    return () => unsub();
  }, []);

  /* ================= FILTER & SEARCH ================= */
  useEffect(() => {
    let result = products;

    // Filter by status
    if (activeFilter === "active") {
      result = result.filter((p) => p.isActive);
    } else if (activeFilter === "inactive") {
      result = result.filter((p) => !p.isActive);
    }

    // Filter by search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.price.toString().includes(term)
      );
    }

    setFilteredProducts(result);
  }, [products, searchTerm, activeFilter]);

  /* ================= FORMAT CURRENCY ================= */
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

  /* ================= BOM HANDLER ================= */
  const addBomItem = () => {
    if (materials.length === 0) {
      errorAlert("Tambahkan bahan terlebih dahulu");
      return;
    }
    setBom([...bom, { materialId: materials[0].id, qty: 1 }]);
  };

  const updateBom = (
    index: number,
    field: "materialId" | "qty",
    value: string | number
  ) => {
    setBom((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: field === "qty" ? Number(value) || 0 : value,
            }
          : item
      )
    );
  };

  const removeBom = (index: number) => {
    setBom(bom.filter((_, i) => i !== index));
  };

  /* ================= CALCULATE PRODUCT METRICS ================= */
  const calculateProductCost = useCallback(
    (bomItems: BOMItem[]) => {
      let totalCost = 0;
      const enrichedBom = bomItems.map((item) => {
        const material = materials.find((m) => m.id === item.materialId);
        const materialCost = 0; // Assuming you have cost field in materials
        const itemCost = materialCost * item.qty;
        totalCost += itemCost;

        return {
          ...item,
          materialName: material?.name || "Unknown",
          unit: material?.unit || "",
          cost: itemCost,
        };
      });

      return { enrichedBom, totalCost };
    },
    [materials]
  );

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const numericPrice = parseCurrency(price);

    if (!name.trim() || numericPrice <= 0 || bom.length === 0) {
      errorAlert("Nama, harga, dan resep wajib diisi");
      return;
    }

    // Validate BOM
    const invalidBom = bom.find((b) => b.qty <= 0);
    if (invalidBom) {
      errorAlert("Kuantitas bahan harus lebih dari 0");
      return;
    }

    try {
      setLoading(true);

      if (editingId) {
        await updateDoc(doc(db, "products", editingId), {
          name: name.trim(),
          price: numericPrice,
          bom,
          updatedAt: Timestamp.now(),
        });
        successAlert("Menu berhasil diperbarui");
      } else {
        await addDoc(collection(db, "products"), {
          name: name.trim(),
          price: numericPrice,
          bom,
          isActive: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        successAlert("Menu berhasil ditambahkan");
      }

      resetForm();
    } catch (err) {
      console.error(err);
      errorAlert("Gagal menyimpan menu");
    } finally {
      setLoading(false);
    }
  };

  /* ================= EDIT ================= */
  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setPrice(formatCurrency(p.price).replace("Rp", "").trim());
    setBom(p.bom);

    // Scroll to form
    document
      .getElementById("product-form")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  /* ================= DELETE ================= */
  const handleDelete = async (p: Product) => {
    const ok = await confirmAlert(
      `Hapus menu "${p.name}"? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "products", p.id));
      successAlert("Menu berhasil dihapus");
    } catch (err) {
      errorAlert("Gagal menghapus menu");
    }
  };

  /* ================= TOGGLE ACTIVE ================= */
  const toggleActive = async (p: Product) => {
    const ok = await confirmAlert(
      p.isActive ? "Nonaktifkan menu ini?" : "Aktifkan menu ini?"
    );
    if (!ok) return;

    await updateDoc(doc(db, "products", p.id), {
      isActive: !p.isActive,
      updatedAt: Timestamp.now(),
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPrice("");
    setBom([]);
  };

  /* ================= GET MATERIAL NAME ================= */
  const getMaterialName = (materialId: string) => {
    const material = materials.find((m) => m.id === materialId);
    return material ? `${material.name} (${material.unit})` : "Unknown";
  };

  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      {/* ================= HEADER ================= */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-lg">
              <ChefHat className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Menu Masakan
              </h1>
              <p className="text-gray-600">Kelola menu dan resep masakan</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2">
              <span className="text-sm text-gray-600 mr-2">Total Menu:</span>
              <span className="font-bold text-emerald-600">
                {products.length}
              </span>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2">
              <span className="text-sm text-gray-600 mr-2">Aktif:</span>
              <span className="font-bold text-emerald-600">
                {products.filter((p) => p.isActive).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ================= LEFT COLUMN - FORM ================= */}
        <div className="space-y-8">
          {/* ================= FORM CARD ================= */}
          <div
            id="product-form"
            className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                  <Plus className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? "Edit Menu" : "Tambah Menu Baru"}
                </h2>
              </div>
              {editingId && (
                <button
                  onClick={resetForm}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                  Batal Edit
                </button>
              )}
            </div>

            <div className="space-y-6">
              {/* NAME INPUT */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Menu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Nasi Goreng Spesial"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* PRICE INPUT */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Harga Jual <span className="text-rose-500">*</span>
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
                <p className="text-xs text-gray-500 mt-2">
                  Harga akan diformat otomatis dengan pemisah ribuan
                </p>
              </div>

              {/* BOM SECTION */}
              <div className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-gray-900">Resep</h3>
                  </div>
                  <button
                    onClick={addBomItem}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Bahan
                  </button>
                </div>

                {bom.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">Belum ada bahan</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Tambahkan bahan untuk membuat resep
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bom.map((b, i) => (
                      <div
                        key={i}
                        className="flex flex-col md:flex-row gap-4 p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl"
                      >
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Bahan
                          </label>
                          <select
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={b.materialId}
                            onChange={(e) =>
                              updateBom(i, "materialId", e.target.value)
                            }
                          >
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="md:w-32">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Jumlah
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="0"
                              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={b.qty}
                              onChange={(e) =>
                                updateBom(i, "qty", e.target.value)
                              }
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                              {materials.find((m) => m.id === b.materialId)
                                ?.unit || ""}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-end md:w-auto">
                          <button
                            onClick={() => removeBom(i)}
                            className="px-4 py-3 bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 hover:from-rose-100 hover:to-rose-200 rounded-lg transition-all"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {bom.length > 0 && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-blue-900">
                        Total Bahan: {bom.length}
                      </span>
                      <span className="text-sm text-blue-700">
                        {bom.reduce((sum, item) => sum + item.qty, 0)} total
                        unit
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Menyimpan...
                    </>
                  ) : editingId ? (
                    <>
                      <Check className="h-5 w-5" />
                      Update Menu
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      Simpan Menu Baru
                    </>
                  )}
                </button>

                {editingId && (
                  <button
                    onClick={resetForm}
                    className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN - PRODUCT LIST ================= */}
        <div className="space-y-6">
          {/* ================= FILTER & SEARCH ================= */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari menu..."
                    className="w-full border border-gray-300 rounded-xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                    <ChefHat className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeFilter === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setActiveFilter("active")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeFilter === "active"
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Aktif
                </button>
                <button
                  onClick={() => setActiveFilter("inactive")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeFilter === "inactive"
                      ? "bg-rose-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Nonaktif
                </button>
              </div>
            </div>
          </div>

          {/* ================= PRODUCT LIST ================= */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">
                Daftar Menu ({filteredProducts.length})
              </h3>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <ChefHat className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">
                  Tidak ada menu ditemukan
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchTerm
                    ? "Coba dengan kata kunci lain"
                    : "Tambahkan menu pertama Anda"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              p.isActive ? "bg-emerald-100" : "bg-rose-100"
                            }`}
                          >
                            {p.isActive ? (
                              <Check className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <X className="h-5 w-5 text-rose-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-bold text-gray-900">
                                {p.name}
                              </h4>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  p.isActive
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {p.isActive ? "AKTIF" : "NONAKTIF"}
                              </span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 mt-2">
                              {formatCurrency(p.price)}
                            </p>
                            <div className="flex items-center gap-4 mt-3">
                              <button
                                onClick={() =>
                                  setShowBomDetails(
                                    showBomDetails === p.id ? null : p.id
                                  )
                                }
                                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                              >
                                {showBomDetails === p.id ? (
                                  <>
                                    <EyeOff className="h-4 w-4" />
                                    Sembunyikan BOM
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4" />
                                    Lihat Bahan ({p.bom.length})
                                  </>
                                )}
                              </button>
                            </div>

                            {showBomDetails === p.id && (
                              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <h5 className="font-medium text-gray-700 mb-3">
                                  Detail Bahan:
                                </h5>
                                <div className="space-y-2">
                                  {p.bom.map((item, index) => (
                                    <div
                                      key={index}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span className="text-gray-600">
                                        {getMaterialName(item.materialId)}
                                      </span>
                                      <span className="font-medium text-gray-900">
                                        {item.qty}{" "}
                                        {materials.find(
                                          (m) => m.id === item.materialId
                                        )?.unit || ""}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => handleEdit(p)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 hover:from-blue-100 hover:to-blue-200 rounded-lg transition-all shadow-sm"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(p)}
                          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all shadow-sm ${
                            p.isActive
                              ? "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 hover:from-amber-100 hover:to-amber-200"
                              : "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 hover:from-emerald-100 hover:to-emerald-200"
                          }`}
                        >
                          {p.isActive ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 hover:from-rose-100 hover:to-rose-200 rounded-lg transition-all shadow-sm"
                        >
                          <Trash2 className="h-4 w-4" />
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
