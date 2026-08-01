"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { LayoutDashboard, LogIn, LogOut, Medal, Search, Shield, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { resolveAssetUrl } from "@/services/api";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/leaders", label: "Leaders", icon: Medal },
  { href: "/search", label: "Search", icon: Search },
  { href: "/login", label: "Login", icon: LogIn },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, user, player, logout } = useAuth();

  const activeHref = useMemo(() => {
    if (pathname?.startsWith("/players/")) return "/players";
    if (pathname?.startsWith("/summary")) return "/";
    return pathname === "/login" ? "/login" : pathname || "/";
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(190,242,100,0.12),_transparent_30%),linear-gradient(180deg,#070912_0%,#0b1020_55%,#070912_100%)] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070912]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-lime-300/15 text-lime-300 ring-1 ring-lime-300/20">
              <Shield size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-lime-300/70">
                Cricket Scorebook
              </p>
              <h1 className="text-lg font-black tracking-tight text-white">
                Multi-user cricket platform
              </h1>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                    isActive
                      ? "bg-lime-300 text-slate-950"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2">
            {loading ? (
              <div className="h-10 w-56 animate-pulse rounded-full bg-white/5" />
            ) : user && player ? (
              <>
                <button
                  type="button"
                  onClick={() => router.push(`/players/${player._id}`)}
                  className="flex items-center gap-3 text-left"
                >
                  {player.profileImage || user.photoURL ? (
                    <img
                      src={resolveAssetUrl(player.profileImage || user.photoURL)}
                      alt={player.name || user.name || "Profile"}
                      className="size-10 rounded-full object-cover ring-2 ring-lime-300/30"
                    />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-full bg-lime-300/15 text-sm font-black text-lime-300">
                      {(player.name || user.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-black text-white">{player.name || user.name}</p>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                      {player.role || "Player"}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/10"
                >
                  <LogOut size={15} />
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-lime-200"
              >
                <LogIn size={15} />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
