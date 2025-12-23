"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  collection,
  onSnapshot,
  runTransaction,
  doc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { successAlert, errorAlert, confirmAlert } from "@/lib/alert";
import {
  ShoppingCart,
  Package,
  Printer,
  X,
  Check,
  Clock,
  AlertCircle,
  DollarSign,
  Plus,
  Minus,
  Receipt,
  Download,
  ShoppingBag,
  RefreshCw,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/* ================= TYPES ================= */
type Material = {
  id: string;
  name: string;
  unit: string;
  stock: number;
};

type BOMItem = {
  materialId: string;
  qty: number;
};

type Product = {
  id: string;
  name: string;
  price: number;
  bom: BOMItem[];
  isActive: boolean;
  category?: string;
};

type SaleItem = {
  productId: string;
  productName: string;
  qty: number;
  price: number;
  total: number;
  note?: string;
};

type ReceiptData = {
  items: SaleItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  grandTotal: number;
  date: Date;
  receiptNumber: string;
  paymentMethod: string;
  cash: number;
  change: number;
};

/* ================= PAGE ================= */
export default function KasirPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris" | "card">(
    "cash"
  );
  const [cashReceived, setCashReceived] = useState<string>("");
  const [customerNote, setCustomerNote] = useState("");
  const [showCart, setShowCart] = useState(true);
  const [showStockWarning, setShowStockWarning] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Ref untuk capture struk
  const receiptRef = useRef<HTMLDivElement>(null);

  // Settings
  const [taxRate] = useState(0.11); // 11% PPN
  const [serviceCharge] = useState(0); // 0% service charge default

  /* ================= FETCH PRODUCTS ================= */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      const data = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, "id">),
        }))
        .filter((p) => p.isActive);

      setProducts(data);
    });
    return () => unsub();
  }, []);

  /* ================= FETCH MATERIALS ================= */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "materials"), (snap) => {
      setMaterials(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Material, "id">),
        }))
      );
    });
    return () => unsub();
  }, []);

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

  const handleCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    const numberValue = Number(value);

    if (value === "") {
      setCashReceived("");
    } else {
      const formatted = new Intl.NumberFormat("id-ID").format(numberValue);
      setCashReceived(formatted);
    }
  };

  /* ================= FILTER PRODUCTS ================= */
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    "all",
    ...new Set(products.map((p) => p.category).filter(Boolean) as string[]),
  ];

  /* ================= CART OPERATIONS ================= */
  const addToCart = (product: Product, quantity: number = 1) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(
        (item) => item.productId === product.id
      );

      if (existingItem) {
        return prevCart.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                qty: item.qty + quantity,
                total: (item.qty + quantity) * item.price,
              }
            : item
        );
      } else {
        return [
          ...prevCart,
          {
            productId: product.id,
            productName: product.name,
            qty: quantity,
            price: product.price,
            total: product.price * quantity,
            note: "",
          },
        ];
      }
    });

    successAlert(`${product.name} ditambahkan ke keranjang`);
  };

  type UpdateFieldValue = number | string;

  const updateCartItem = (
    productId: string,
    field: "qty" | "note",
    value: UpdateFieldValue
  ) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId
          ? {
              ...item,
              [field]:
                field === "qty" ? Math.max(1, Number(value)) : String(value),
              total:
                field === "qty"
                  ? Math.max(1, Number(value)) * item.price
                  : item.total,
            }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) =>
      prevCart.filter((item) => item.productId !== productId)
    );
  };

  const clearCart = () => {
    setCart([]);
    setCustomerNote("");
    setCashReceived("");
    setPaymentMethod("cash");
  };

  /* ================= CALCULATE TOTALS ================= */
  const calculateTotals = useCallback(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * taxRate;
    const service = subtotal * serviceCharge;
    const grandTotal = subtotal + tax + service;
    const cashNum = parseCurrency(cashReceived);
    const change = cashNum - grandTotal;

    return {
      subtotal,
      tax,
      service,
      grandTotal,
      change: Math.max(0, change),
      cash: cashNum,
    };
  }, [cart, cashReceived, taxRate, serviceCharge]);

  const totals = calculateTotals();

  /* ================= CHECK STOCK ================= */
  const checkStockEnough = (
    cartItems: SaleItem[]
  ): { ok: boolean; message?: string } => {
    if (cartItems.length === 0) {
      return { ok: false, message: "Keranjang kosong" };
    }

    for (const cartItem of cartItems) {
      const product = products.find((p) => p.id === cartItem.productId);
      if (!product) return { ok: false, message: "Produk tidak ditemukan" };

      for (const bomItem of product.bom) {
        const material = materials.find((m) => m.id === bomItem.materialId);
        if (!material) return { ok: false, message: "Bahan tidak ditemukan" };

        const needed = bomItem.qty * cartItem.qty;
        if (material.stock < needed) {
          return {
            ok: false,
            message: `Stok ${material.name} kurang (butuh ${needed} ${material.unit}, tersedia ${material.stock})`,
          };
        }
      }
    }
    return { ok: true };
  };

  const checkIndividualStock = (product: Product, qty: number = 1) => {
    for (const bomItem of product.bom) {
      const material = materials.find((m) => m.id === bomItem.materialId);
      if (material && material.stock < bomItem.qty * qty) {
        return {
          insufficient: true,
          materialName: material.name,
          needed: bomItem.qty * qty,
          available: material.stock,
        };
      }
    }
    return { insufficient: false };
  };

  /* ================= SUBMIT SALE ================= */
  const handleSubmitSale = async () => {
    if (cart.length === 0) {
      errorAlert("Keranjang kosong");
      return;
    }

    const check = checkStockEnough(cart);
    if (!check.ok) {
      errorAlert(check.message || "Stok tidak cukup");
      return;
    }

    if (paymentMethod === "cash" && totals.cash < totals.grandTotal) {
      errorAlert("Uang tunai kurang");
      return;
    }

    const ok = await confirmAlert(
      `Proses transaksi ${cart.length} item?\nTotal: ${formatCurrency(
        totals.grandTotal
      )}`
    );
    if (!ok) return;

    try {
      setLoading(true);

      const receiptNumber = `TRX-${Date.now().toString().slice(-6)}`;

      await runTransaction(db, async (transaction) => {
        // ===== 1. READ SEMUA MATERIAL =====
        const materialMap = new Map();

        for (const cartItem of cart) {
          const product = products.find((p) => p.id === cartItem.productId);
          if (!product) continue;

          for (const bomItem of product.bom) {
            const materialRef = doc(db, "materials", bomItem.materialId);

            if (!materialMap.has(bomItem.materialId)) {
              const snap = await transaction.get(materialRef);

              if (!snap.exists()) {
                throw new Error("Bahan tidak ditemukan");
              }

              materialMap.set(bomItem.materialId, {
                ref: materialRef,
                stock: snap.data().stock || 0,
              });
            }
          }
        }

        // ===== 2. HITUNG KEBUTUHAN =====
        const usageMap = new Map();

        for (const cartItem of cart) {
          const product = products.find((p) => p.id === cartItem.productId);
          if (!product) continue;

          for (const bomItem of product.bom) {
            const needed = bomItem.qty * cartItem.qty;
            usageMap.set(
              bomItem.materialId,
              (usageMap.get(bomItem.materialId) || 0) + needed
            );
          }
        }

        // ===== 3. VALIDASI + UPDATE =====
        for (const [materialId, needed] of usageMap.entries()) {
          const material = materialMap.get(materialId);

          if (material.stock < needed) {
            throw new Error("Stok bahan tidak mencukupi");
          }

          transaction.update(material.ref, {
            stock: material.stock - needed,
            lastUsed: Timestamp.now(),
          });
        }
      });

      // Simpan sales per item
      for (const cartItem of cart) {
        await addDoc(collection(db, "sales"), {
          productId: cartItem.productId,
          productName: cartItem.productName,
          qty: cartItem.qty,
          price: cartItem.price,
          total: cartItem.total,
          note: cartItem.note || null,
          receiptNumber,
          paymentMethod,
          date: Timestamp.now(),
        });
      }

      // Simpan transaksi summary
      await addDoc(collection(db, "transactions"), {
        receiptNumber,
        items: cart.map((item) => ({
          productName: item.productName,
          qty: item.qty,
          price: item.price,
          total: item.total,
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        serviceCharge: totals.service,
        grandTotal: totals.grandTotal,
        paymentMethod,
        cash: totals.cash,
        change: totals.change,
        customerNote: customerNote.trim() || null,
        date: Timestamp.now(),
        status: "completed",
      });

      // Prepare receipt data
      const receipt: ReceiptData = {
        items: [...cart],
        subtotal: totals.subtotal,
        tax: totals.tax,
        serviceCharge: totals.service,
        grandTotal: totals.grandTotal,
        date: new Date(),
        receiptNumber,
        paymentMethod,
        cash: totals.cash,
        change: totals.change,
      };

      setReceiptData(receipt);
      setShowReceipt(true);
      clearCart();

      successAlert(`Transaksi ${receiptNumber} berhasil!`);
    } catch (err: unknown) {
      console.error(err);
      errorAlert(
        err instanceof Error ? err.message : "Gagal memproses transaksi"
      );
    } finally {
      setLoading(false);
    }
  };

  /* ================= GENERATE PDF ================= */
  const generatePDF = async () => {
    if (!receiptRef.current || !receiptData) return;

    try {
      setIsGeneratingPDF(true);

      // Tambahkan sedikit delay untuk memastikan DOM sudah siap
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2, // Resolusi tinggi
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 200], // Ukuran struk kecil
      });

      // Hitung dimensi untuk struk
      const imgWidth = 80;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`struk-${receiptData.receiptNumber}.pdf`);

      successAlert("PDF berhasil diunduh");
    } catch (error) {
      console.error("Error generating PDF:", error);
      errorAlert("Gagal membuat PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  /* ================= PRINT RECEIPT ================= */
  const printReceipt = async () => {
    if (!receiptRef.current || !receiptData) return;

    try {
      setIsGeneratingPDF(true);

      // Tambahkan sedikit delay untuk memastikan DOM sudah siap
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");

      // Buka window baru untuk print
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        errorAlert("Popup diblokir! Izinkan popup untuk mencetak struk.");
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Struk ${receiptData.receiptNumber}</title>
          <style>
            body { 
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #f5f5f5;
            }
            @media print {
              body { 
                background: white;
                padding: 0;
              }
              .receipt-container {
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                width: 80mm !important;
              }
            }
            .receipt-container {
              width: 80mm;
              background: white;
              font-family: 'Courier New', monospace;
              padding: 10px;
            }
          </style>
        </head>
        <body>
          <img src="${imgData}" style="width: 100%; height: auto;" />
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            }
          </script>
        </body>
        </html>
      `);

      printWindow.document.close();
    } catch (error) {
      console.error("Error printing receipt:", error);
      errorAlert("Gagal mencetak struk");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  /* ================= CLOSE RECEIPT MODAL ================= */
  const closeReceiptModal = () => {
    setShowReceipt(false);
    setReceiptData(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      {/* ================= HEADER ================= */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Kasir Restoran
              </h1>
              <p className="text-gray-600">Sistem kasir point of sale modern</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm text-emerald-700">Jam Operasional</p>
                  <p className="font-bold text-emerald-900">08:00 - 22:00</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-700">Kasir Aktif</p>
                  <p className="font-bold text-blue-900">Kasir 01</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ================= LEFT COLUMN - PRODUCTS ================= */}
        <div className="lg:col-span-2 space-y-6">
          {/* ================= SEARCH & FILTER ================= */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
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
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === category
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {category === "all" ? "Semua" : category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ================= PRODUCT GRID ================= */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Daftar Menu</h2>
              <span className="text-sm text-gray-600">
                {filteredProducts.length} produk tersedia
              </span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">
                  Tidak ada menu ditemukan
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchTerm
                    ? "Coba dengan kata kunci lain"
                    : "Semua menu sedang tidak tersedia"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredProducts.map((product) => {
                  const stockCheck = checkIndividualStock(product);
                  const inCart = cart.find(
                    (item) => item.productId === product.id
                  );

                  return (
                    <div
                      key={product.id}
                      className={`border rounded-xl p-4 transition-all hover:shadow-md ${
                        stockCheck.insufficient
                          ? "border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100"
                          : inCart
                          ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-900 line-clamp-1">
                          {product.name}
                        </h3>
                        {inCart && (
                          <div className="bg-emerald-500 text-white text-xs px-2 py-1 rounded-full">
                            {inCart.qty}x
                          </div>
                        )}
                      </div>

                      <p className="text-lg font-bold text-gray-900 mb-3">
                        {formatCurrency(product.price)}
                      </p>

                      {stockCheck.insufficient ? (
                        <div className="mb-3 p-2 bg-gradient-to-r from-rose-100 to-rose-200 rounded-lg">
                          <div className="flex items-center gap-1 text-rose-800 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            Stok {stockCheck.materialName} kurang
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-3">
                          <Package className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-600">
                            {product.bom.length} bahan
                          </span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => addToCart(product)}
                          disabled={stockCheck.insufficient || loading}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                            stockCheck.insufficient
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                              : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
                          }`}
                        >
                          + Tambah
                        </button>
                        {inCart && (
                          <button
                            onClick={() =>
                              updateCartItem(product.id, "qty", inCart.qty + 1)
                            }
                            disabled={stockCheck.insufficient || loading}
                            className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT COLUMN - CART ================= */}
        <div className="space-y-6">
          {/* ================= CART SUMMARY ================= */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Keranjang</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCart(!showCart)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {showCart ? (
                    <Minus className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={clearCart}
                  className="p-2 hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded-lg transition-colors"
                  title="Kosongkan keranjang"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Keranjang kosong</p>
                <p className="text-sm text-gray-500 mt-1">
                  Pilih menu dari daftar
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {cart.map((item) => {
                    const product = products.find(
                      (p) => p.id === item.productId
                    );
                    const stockCheck = product
                      ? checkIndividualStock(product, item.qty)
                      : null;

                    return (
                      <div
                        key={item.productId}
                        className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900">
                              {item.productName}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {formatCurrency(item.price)} × {item.qty}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">
                              {formatCurrency(item.total)}
                            </span>
                            <button
                              onClick={() => removeFromCart(item.productId)}
                              className="p-1 hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {stockCheck?.insufficient && (
                          <div className="mt-2 p-2 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg">
                            <div className="flex items-center gap-1 text-amber-800 text-sm">
                              <AlertCircle className="h-3 w-3" />
                              Stok mungkin kurang
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-3">
                          <div className="flex items-center gap-1 flex-1">
                            <button
                              onClick={() =>
                                updateCartItem(
                                  item.productId,
                                  "qty",
                                  item.qty - 1
                                )
                              }
                              className="p-1 hover:bg-gray-100 rounded"
                              disabled={item.qty <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) =>
                                updateCartItem(
                                  item.productId,
                                  "qty",
                                  e.target.value
                                )
                              }
                              className="w-16 text-center border rounded px-2 py-1"
                            />
                            <button
                              onClick={() =>
                                updateCartItem(
                                  item.productId,
                                  "qty",
                                  item.qty + 1
                                )
                              }
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder="Catatan item..."
                          value={item.note || ""}
                          onChange={(e) =>
                            updateCartItem(
                              item.productId,
                              "note",
                              e.target.value
                            )
                          }
                          className="w-full mt-2 text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* ================= PAYMENT SECTION ================= */}
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Metode Pembayaran
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setPaymentMethod("cash")}
                        className={`p-3 rounded-xl border font-medium transition-all ${
                          paymentMethod === "cash"
                            ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600"
                            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Tunai
                      </button>
                      <button
                        onClick={() => setPaymentMethod("qris")}
                        className={`p-3 rounded-xl border font-medium transition-all ${
                          paymentMethod === "qris"
                            ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-600"
                            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        QRIS
                      </button>
                      <button
                        onClick={() => setPaymentMethod("card")}
                        className={`p-3 rounded-xl border font-medium transition-all ${
                          paymentMethod === "card"
                            ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white border-purple-600"
                            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Kartu
                      </button>
                    </div>
                  </div>

                  {paymentMethod === "cash" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Uang Diterima
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                          Rp
                        </span>
                        <input
                          type="text"
                          placeholder="0"
                          className="w-full border border-gray-300 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right text-lg font-medium"
                          value={cashReceived}
                          onChange={handleCashChange}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Catatan Pelanggan (Opsional)
                    </label>
                    <textarea
                      placeholder="Contoh: Pedas, tanpa bawang, dll."
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24"
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                    />
                  </div>

                  {/* ================= TOTALS ================= */}
                  <div className="space-y-2 pt-4 border-t border-gray-200">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>PPN (11%)</span>
                      <span>{formatCurrency(totals.tax)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Service Charge (0%)</span>
                      <span>{formatCurrency(totals.service)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                      <span>TOTAL</span>
                      <span>{formatCurrency(totals.grandTotal)}</span>
                    </div>
                    {paymentMethod === "cash" && totals.cash > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Uang Diterima</span>
                        <span>{formatCurrency(totals.cash)}</span>
                      </div>
                    )}
                    {paymentMethod === "cash" && totals.change > 0 && (
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Kembalian</span>
                        <span>{formatCurrency(totals.change)}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSubmitSale}
                    disabled={
                      loading ||
                      cart.length === 0 ||
                      (paymentMethod === "cash" &&
                        totals.cash < totals.grandTotal)
                    }
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <>
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Memproses...
                      </>
                    ) : (
                      <>
                        <DollarSign className="h-5 w-5" />
                        Bayar {formatCurrency(totals.grandTotal)}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================= RECEIPT MODAL (TANPA BACKDROP) ================= */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full my-8">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg">
                    <Receipt className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Struk Pembayaran
                  </h2>
                </div>
                <button
                  onClick={closeReceiptModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* ================= STRUK CONTENT (UNTUK CAPTURE) ================= */}
              <div
                ref={receiptRef}
                className="bg-white p-4 border-2 border-gray-300 rounded-lg font-mono text-sm"
                style={{
                  width: "300px",
                  maxWidth: "100%",
                  margin: "0 auto",
                }}
              >
                <div className="text-center mb-4">
                  <div className="text-lg font-bold mb-1">
                    RM NASI PADANG ASMARA
                  </div>
                  <div className="text-gray-600">Jl. Restoran No. 123</div>
                  <div className="text-gray-600">Telp: (021) 123-4567</div>
                  <div className="text-xs text-gray-500 mt-2">
                    {receiptData.date.toLocaleString("id-ID")}
                  </div>
                  <div className="text-sm font-bold mt-2">
                    #{receiptData.receiptNumber}
                  </div>
                </div>

                <div className="border-t border-b border-gray-400 py-2 my-3">
                  <div className="flex justify-between font-bold mb-2">
                    <span>ITEM</span>
                    <span>TOTAL</span>
                  </div>

                  {receiptData.items.map((item, index) => (
                    <div key={index} className="mb-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{item.productName}</span>
                        <span>{formatCurrency(item.total)}</span>
                      </div>
                      <div className="text-gray-600 text-xs ml-2">
                        {item.qty} × {formatCurrency(item.price)}
                        {item.note && ` (${item.note})`}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 mb-4">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(receiptData.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PPN (11%):</span>
                    <span>{formatCurrency(receiptData.tax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service Charge:</span>
                    <span>{formatCurrency(receiptData.serviceCharge)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-gray-400 pt-2">
                    <span>GRAND TOTAL:</span>
                    <span>{formatCurrency(receiptData.grandTotal)}</span>
                  </div>

                  <div className="border-t border-gray-400 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span>Metode:</span>
                      <span className="font-bold">
                        {receiptData.paymentMethod.toUpperCase()}
                      </span>
                    </div>
                    {receiptData.paymentMethod === "cash" && (
                      <>
                        <div className="flex justify-between">
                          <span>Tunai:</span>
                          <span>{formatCurrency(receiptData.cash)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-emerald-700">
                          <span>Kembalian:</span>
                          <span>{formatCurrency(receiptData.change)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-center text-xs text-gray-500 border-t border-gray-400 pt-4">
                  <div className="mb-2 font-bold">
                    *** TERIMA KASIH TELAH BERBELANJA ***
                  </div>
                  <div>Struk ini sebagai bukti pembayaran</div>
                  <div>
                    Barang yang sudah dibeli tidak dapat ditukar/dikembalikan
                  </div>
                </div>
              </div>

              {/* ================= ACTION BUTTONS ================= */}
              <div className="flex flex-col gap-3 mt-6">
                <button
                  onClick={generatePDF}
                  disabled={isGeneratingPDF}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPDF ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Membuat PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      Simpan sebagai PDF
                    </>
                  )}
                </button>

                <button
                  onClick={printReceipt}
                  disabled={isGeneratingPDF}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPDF ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Mempersiapkan...
                    </>
                  ) : (
                    <>
                      <Printer className="h-5 w-5" />
                      Cetak Struk
                    </>
                  )}
                </button>

                <button
                  onClick={closeReceiptModal}
                  className="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= GLOBAL STYLES ================= */}
      <style jsx>{`
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
