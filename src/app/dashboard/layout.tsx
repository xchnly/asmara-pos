"use client";

import Link from "next/link";
import {
  Home,
  ShoppingCart,
  Utensils,
  Package,
  BarChart3,
  LogOut,
  ChefHat,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => isMobile && setSidebarOpen(false);

  const handleLogout = async () => {
    try {
      // Hapus semua session storage
      sessionStorage.removeItem("firebase_token");
      localStorage.removeItem("rememberedEmail");

      // Sign out dari Firebase
      await signOut(auth);

      // Tunggu sebentar sebelum redirect
      setTimeout(() => {
        router.replace("/");
      }, 300);
    } catch (err) {
      console.error("Logout gagal:", err);
      // Fallback: redirect manual
      router.replace("/");
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* OVERLAY MOBILE */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
          ${isMobile ? "fixed" : "sticky"}
          top-0 left-0 h-screen w-72
          bg-gradient-to-b from-slate-900 to-emerald-950
          text-slate-100 flex flex-col z-50
          transition-transform duration-300
          ${isMobile && !sidebarOpen ? "-translate-x-full" : ""}
        `}
      >
        {/* HEADER */}
        <div className="px-6 py-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">AsmaraPOS</h1>
              <p className="text-xs text-slate-400">Sistem Kasir</p>
            </div>
          </div>

          {isMobile && (
            <button onClick={toggleSidebar}>
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>

        {/* NAV */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          <SidebarLink href="/dashboard" icon={<Home />} label="Dashboard" />
          <SidebarLink
            href="/dashboard/kasir"
            icon={<ShoppingCart />}
            label="Kasir"
          />
          <SidebarLink
            href="/dashboard/menu"
            icon={<Utensils />}
            label="Menu"
          />
          <SidebarLink
            href="/dashboard/stok"
            icon={<Package />}
            label="Stok"
          />
          <SidebarLink
            href="/dashboard/stock-in"
            icon={<Package />}
            label="Stock In"
          />
          <SidebarLink
            href="/dashboard/laporan"
            icon={<BarChart3 />}
            label="Laporan"
          />
        </nav>

        {/* LOGOUT */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10"
          >
            <LogOut className="w-5 h-5" />
            Keluar
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
        <div className="mb-6 flex items-center gap-3">
          {isMobile && (
            <button
              onClick={toggleSidebar}
              className="p-2 bg-white border rounded-xl"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 lg:p-6 min-h-[70vh]">
          {children}
        </div>

        <footer className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} AsmaraPOS
        </footer>
      </main>
    </div>
  );
}

/* ===================== */
/* SIDEBAR LINK */
/* ===================== */

function SidebarLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
    >
      <span className="w-5 h-5">{icon}</span>
      {label}
    </Link>
  );
}