"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Talents", href: "/talents" },
  { label: "Upload", href: "/uploads" },
  { label: "Liens", href: "/links" },
];

function isActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    setMenuOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="flex items-center border-b border-neutral-200 bg-white px-6" style={{ height: 56 }}>
      {/* Logo */}
      <Link
        href="/dashboard"
        className="text-[11px] font-semibold uppercase tracking-wide text-neutral-900"
      >
        REEL.SAD-PICTURES.COM
      </Link>

      {/* Pill nav - centered */}
      <nav className="mx-auto flex items-center gap-0.5 rounded-xl bg-neutral-100 p-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                active
                  ? "bg-white font-semibold text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((p) => !p)}
          className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          aria-label="Menu"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2 text-[12px] text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Deconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
