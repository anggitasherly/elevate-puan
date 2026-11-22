"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/sign-out";
import Link from "next/link";
import Sidebar from "./Sidebar";
import {
  Menu,
  ChevronDown,
  ChevronUp,
  Bell,
  UserRound,
  LogOut,
  Sparkles,
} from "lucide-react";

const pageTitles = {
  "/home": "Home",
  "/business-overview": "Business Overview",
  "/financial-readiness": "Financial Readiness",
  "/realistic-condition": "Realistic Condition",
  "/history": "Experiment History",
  "/insights": "Growth Insights",
  "/profile": "Profile",
};

function getPageTitle(pathname) {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/experiments")) return "My Experiment";
  return "My Workspace";
}

/* Sparkles: sedikit saja, tersebar, gaya sama dengan Sidebar */
function SparkleDecor() {
  return (
    <>
      <Sparkles
        size={30}
        className="pointer-events-none absolute left-6 top-28 z-0 rotate-12 text-pink-200 opacity-70"
      />
      <Sparkles
        size={20}
        className="pointer-events-none absolute right-16 top-32 z-0 hidden animate-pulse text-violet-300 motion-reduce:animate-none md:block"
      />
      <Sparkles
        size={24}
        className="pointer-events-none absolute left-[5%] top-[45%] z-0 rotate-6 text-pink-200 opacity-70"
      />
      <Sparkles
        size={26}
        className="pointer-events-none absolute right-[10%] top-[34%] z-0 hidden rotate-12 text-pink-300 opacity-80 md:block"
      />
      <Sparkles
        size={26}
        className="pointer-events-none absolute bottom-28 left-10 z-0 -rotate-12 text-violet-200 opacity-70"
      />
      <Sparkles
        size={30}
        className="pointer-events-none absolute bottom-16 right-10 z-0 hidden rotate-12 text-pink-300 opacity-80 md:block"
      />
    </>
  );
}

export default function DashboardLayout({ children, userName = "" }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Nama pengguna yang login (dikirim dari app/(app)/layout.js).
  // Kalau kosong, tampil "Pengguna" supaya header tidak kosong.
  const displayName = userName.trim() || "Pengguna";
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSignOut() {
    setProfileMenuOpen(false);
    await signOut(router);
  }

  const pageTitle = getPageTitle(pathname);

  const [lastPathname, setLastPathname] = useState(pathname);

  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-page text-ink md:flex">
      {/* Overlay mobile */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Tutup navigasi"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-ink/30 md:hidden"
        />
      )}

      {/* Sidebar */}
      <div
        className={`${
          mobileMenuOpen
            ? "fixed inset-y-0 left-0 z-50 block"
            : "hidden"
        } md:sticky md:top-0 md:block md:h-screen md:shrink-0`}
      >
        <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
      </div>

      {/* Konten utama: kiri putih bersih, kanan lebih cerah (pink, ungu, mint) */}
      <div className="relative isolate min-w-0 flex-1 overflow-x-clip bg-[linear-gradient(100deg,#ffffff_0%,#fffdfe_35%,#fdf4fb_65%,#f1ecff_100%)]">
        {/* Semburat sangat tipis di kiri */}
        <div className="pointer-events-none absolute -left-24 top-24 z-0 h-80 w-80 rounded-full bg-[#fde8f4]/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 z-0 h-64 w-64 rounded-full bg-[#e6f7ef]/40 blur-3xl" />

        {/* Warna cerah di kanan */}
        <div className="pointer-events-none absolute -right-24 top-24 z-0 h-96 w-96 rounded-full bg-[#f9c9ed]/45 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-[480px] z-0 h-[26rem] w-[26rem] rounded-full bg-[#dcd2ff]/50 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-32 z-0 h-64 w-64 rounded-full bg-[#d6f4e8]/45 blur-3xl" />

        <SparkleDecor />

        {/* Navbar: tinggi h-20 (80px), sama dengan baris atas Sidebar */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-border bg-white/85 px-4 backdrop-blur-md sm:px-6 md:justify-end md:px-8">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Buka menu navigasi"
            aria-expanded={mobileMenuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-brand transition hover:bg-brand-soft md:hidden"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifikasi: tampilan saja untuk saat ini */}
            <button
              type="button"
              aria-label="Notifikasi"
              className="relative rounded-full p-2 text-brand transition hover:bg-brand-soft"
            >
              <Bell size={20} strokeWidth={1.8} />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blush" />
            </button>

            {/* Dropdown profil */}
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setProfileMenuOpen((previous) => !previous)
                }
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                aria-label="Menu profil pengguna"
                className="flex items-center gap-2 rounded-xl p-1.5 text-left transition hover:bg-lav-pale"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                  {initial}
                </span>

                <span className="hidden sm:block">
                  <span className="block text-sm font-semibold text-ink">
                    {displayName}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    Pemilik UMKM
                  </span>
                </span>

                <span className="hidden text-ink-muted sm:block">
                  {profileMenuOpen ? (
                    <ChevronUp size={16} strokeWidth={1.8} />
                  ) : (
                    <ChevronDown size={16} strokeWidth={1.8} />
                  )}
                </span>
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-border bg-white shadow-lg"
                >
                  <div className="flex items-center gap-3 border-b border-border p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft font-bold text-brand">
                      {initial}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {displayName}
                      </p>
                      <p className="text-xs text-ink-muted">
                        Pemilik UMKM
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/profile"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-ink transition hover:bg-lav-pale hover:text-brand"
                  >
                    <UserRound size={16} strokeWidth={1.8} />
                    Profile
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-sm text-pink-ink transition hover:bg-pink-pale"
                  >
                    <LogOut size={16} strokeWidth={1.8} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Area halaman */}
        <main className="relative z-10 min-h-[calc(100vh-5rem)] p-4 sm:p-6 md:p-8">
          <nav
            aria-label="Breadcrumb"
            className="mb-5 text-xs font-medium text-ink-muted"
          >
            {pathname === "/home" ? (
              <span aria-current="page" className="text-ink">
                Home
              </span>
            ) : (
              <>
                <Link
                  href="/home"
                  className="transition hover:text-brand"
                >
                  Home
                </Link>

                <span className="mx-2" aria-hidden="true">
                  /
                </span>

                <span aria-current="page" className="text-ink">
                  {pageTitle}
                </span>
              </>
            )}
          </nav>

          {children}
        </main>
      </div>
    </div>
  );
}