import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* NAV - Glassmorphism effect */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-200/80 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md">
              <span className="text-2xl">🍛</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-emerald-700 bg-clip-text text-transparent">
              AsmaraPOS
            </h1>
          </div>
          
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100/80 hover:shadow-sm transition-all duration-300 font-medium"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-emerald-900 text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 font-medium shadow-md"
            >
              Register
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-5xl text-center">
          {/* Animated gradient background */}
          <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]"></div>
          
          <div className="relative">
            {/* Floating elements */}
            <div className="absolute -top-10 -left-10 w-72 h-72 bg-emerald-300/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-slate-300/20 rounded-full blur-3xl"></div>
            
            <h2 className="text-5xl md:text-7xl font-black mb-8 leading-tight">
              <span className="block text-slate-900">
                Sistem Kasir Modern
              </span>
              <span className="block mt-2">
                <span className="bg-gradient-to-r from-emerald-500 to-emerald-700 bg-clip-text text-transparent">
                  RM Nasi Padang Asmara
                </span>
              </span>
            </h2>

            <p className="text-xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Optimalkan penjualan dan kelola stok dengan sistem yang 
              <span className="font-semibold text-emerald-600"> cepat, modern, dan intuitif</span>. 
              Pantau laporan real-time dengan satu platform terintegrasi.
            </p>

            <div className="flex justify-center gap-6 flex-wrap">
              <Link
                href="/login"
                className="group relative px-10 py-4 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-900 text-white font-bold shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-3"
              >
                <span>Masuk Aplikasi</span>
                <span className="group-hover:translate-x-2 transition-transform">→</span>
              </Link>

              <Link
                href="/register"
                className="px-10 py-4 rounded-2xl bg-white/80 backdrop-blur-sm border-2 border-slate-200 text-slate-800 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 hover:border-emerald-300"
              >
                Daftar Sekarang
              </Link>
            </div>

            {/* Stats Preview */}
            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
              <div className="p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-slate-100 shadow-sm">
                <div className="text-3xl font-bold text-emerald-600">99%</div>
                <div className="text-slate-600 mt-2">Operasional Lebih Cepat</div>
              </div>
              <div className="p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-slate-100 shadow-sm">
                <div className="text-3xl font-bold text-emerald-600">24/7</div>
                <div className="text-slate-600 mt-2">Laporan Real-time</div>
              </div>
              <div className="p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-slate-100 shadow-sm">
                <div className="text-3xl font-bold text-emerald-600">100+</div>
                <div className="text-slate-600 mt-2">Transaksi/Hari</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200/80 py-8 text-center text-slate-500 bg-white/40 backdrop-blur-sm mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700">
                <span className="text-lg">🍛</span>
              </div>
              <span className="font-semibold text-slate-800">AsmaraPOS</span>
            </div>
            
            <div className="text-sm">
              © {new Date().getFullYear()} All rights reserved. 
              <span className="text-emerald-600 font-medium"> RM Nasi Padang Asmara</span>
            </div>
            
            <div className="text-sm text-slate-400">
              Modern POS System v2.0
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}