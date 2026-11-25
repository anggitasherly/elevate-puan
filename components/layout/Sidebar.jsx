"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  House,
  Wallet,
  FlaskConical,
  History,
  Sparkles,
  Heart,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const menuItems = [
  { label: "Home", href: "/home", icon: House },
  {
    label: "Financial Readiness",
    href: "/financial-readiness",
    icon: Wallet,
  },
  {
    label: "My Experiment",
    href: "/experiments/daily",
    match: "/experiments",
    icon: FlaskConical,
  },
  {
    label: "Experiment History",
    href: "/history",
    icon: History,
  },
  {
    label: "Growth Insights",
    href: "/insights",
    icon: Sparkles,
  },
];

export default function Sidebar({ onNavigate }) {
  const [isOpen, setIsOpen] = useState(true);
  const pathname = usePathname();

  return (
    <aside
      className={`relative flex h-full min-h-screen shrink-0 flex-col
        overflow-hidden border-r border-pink-100
        bg-gradient-to-b from-white via-[#fffaff] to-[#fff0f8]
        backdrop-blur-md transition-[width] duration-300
        md:min-h-0 md:h-screen
        ${isOpen ? "w-64 px-3" : "w-[4.5rem] px-2"} pb-3`}
    >
      {/* Ornamen sparkles (hanya saat terbuka) */}
      {isOpen && (
        <>
          <Sparkles
            size={34}
            className="pointer-events-none absolute right-2 top-[150px] z-20 rotate-12 text-pink-300 opacity-80"
          />
          <Sparkles
            size={22}
            className="pointer-events-none absolute left-2 top-[390px] z-20 -rotate-12 text-violet-300 opacity-80"
          />
        </>
      )}

      {/* Baris atas */}
      <div
        className={`relative z-10 flex h-20 shrink-0 items-center
          ${
            isOpen
              ? "-mx-3 px-3"
              : "-mx-2 justify-center border-b border-pink-100 px-2"
          }`}
      >
        {/* Garis lembut memudar */}
        {isOpen && (
          <span className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent" />
        )}

        {/* Logo (ukuran besar, posisi sedikit diturunkan) */}
        {isOpen && (
          <Link
            href="/home"
            onClick={onNavigate}
            aria-label="Elevate Puan - ke Home"
            className="group relative z-10 flex h-20 w-full max-w-[190px] translate-y-[6px] items-center justify-center"
          >
            {/* Cahaya lembut di belakang logo */}
            <div className="absolute h-20 w-20 rounded-full bg-pink-100/70 blur-xl" />

            {/* Logo bergerak */}
            <img
              src="/images/logo-elevatepuan.png"
              alt="Elevate Puan"
              className="ep-logo-move relative z-10 h-[88px] w-full object-contain transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />

            {/* Sparkles di sekitar logo */}
            <Sparkles
              size={14}
              className="absolute right-0 top-3 animate-pulse text-pink-400"
            />
            <Sparkles
              size={12}
              className="absolute bottom-3 left-0 animate-pulse text-violet-400"
            />
          </Link>
        )}

        {/* Tombol tutup / buka */}
        <button
          type="button"
          onClick={() => setIsOpen((previous) => !previous)}
          aria-label={isOpen ? "Perkecil sidebar" : "Perbesar sidebar"}
          aria-expanded={isOpen}
          title={isOpen ? "Perkecil sidebar" : "Perbesar sidebar"}
          className={`z-20 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
            border border-pink-100 bg-white/90 text-violet-600 shadow-sm
            transition-all hover:border-pink-300 hover:bg-pink-50 hover:text-pink-600
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            ${isOpen ? "absolute right-3 top-1/2 -translate-y-1/2" : ""}`}
        >
          {isOpen ? (
            <PanelLeftClose size={18} strokeWidth={1.8} />
          ) : (
            <PanelLeftOpen size={18} strokeWidth={1.8} />
          )}
        </button>
      </div>

      {/* Tulisan di bawah garis */}
      {isOpen && (
        <p className="relative z-10 mb-3 mt-3 text-center text-[9px] font-semibold tracking-[2px] text-violet-400">
          GROW YOUR BUSINESS
        </p>
      )}

      {/* Jarak kalau sidebar dikecilkan */}
      {!isOpen && <div className="h-3 shrink-0" />}

      {/* Navigasi */}
      <nav
        aria-label="Navigasi utama"
        className="relative z-10 flex flex-col gap-1"
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.match
            ? pathname.startsWith(item.match)
            : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={!isOpen ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-11 items-center rounded-xl text-[13px]
                transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                ${isOpen ? "gap-3 px-3" : "justify-center px-0"}
                ${
                  isActive
                    ? "bg-gradient-to-r from-violet-100 to-pink-100 font-extrabold text-violet-800 shadow-sm"
                    : "font-semibold text-slate-600 hover:bg-pink-50 hover:text-pink-600"
                }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <Icon size={19} strokeWidth={1.8} />
              </span>

              {isOpen && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Penutup bawah: tagline + hati */}
      <div className="mt-auto">
        {isOpen && (
          <div className="mb-3 flex flex-col items-center gap-2 px-2">
            <p className="text-center text-[13px] font-medium italic leading-6 text-violet-700">
              Bigger Dreams
              <br />
              Better Business
              <br />
              Together.
            </p>

            <Heart size={14} className="fill-pink-600 text-pink-600" />
          </div>
        )}
      </div>

      {/* Animasi logo */}
      <style jsx global>{`
        @keyframes ep-float {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-3px) rotate(1.5deg);
          }
        }

        .ep-logo-move {
          animation: ep-float 3.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .ep-logo-move {
            animation: none;
          }
        }
      `}</style>
    </aside>
  );
}