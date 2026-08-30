"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useState, useEffect } from "react";
import SignOutButton from "../dashboard/SignOutButton";
import ThemeToggle from "@/components/ThemeToggle";

interface Props {
  email: string;
  pendingCount: number;
}

export default function AdminSidebar({ email, pendingCount }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const navItems = [
    { icon: "📥", label: "Approbations",   href: "/admin",       badge: pendingCount },
    { icon: "🧪", label: "Tests",          href: "/admin/tests" },
    { icon: "📚", label: "Docs",           href: "/admin/docs" },
    { icon: "🏗️", label: "Infrastructure", href: "/admin/infra" },
  ];

  const navContent = (
    <>
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-colors ${
                active
                  ? "bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 font-medium"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}>
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-teal-600 text-white text-xs font-semibold">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-600 text-xs font-bold flex-shrink-0">
            {email?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-900 dark:text-white truncate">Admin</p>
            <p className="text-xs text-zinc-400 truncate">{email}</p>
          </div>
        </div>
        <ThemeToggle />
        <SignOutButton />
      </div>
    </>
  );

  return (
    <>
      <div className="sm:hidden fixed top-0 inset-x-0 z-20 h-14 flex items-center px-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="3" y1="5" x2="17" y2="5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="15" x2="17" y2="15"/>
          </svg>
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-xl">🦷</span>
          <span className="font-bold text-zinc-900 dark:text-white">DentiCare Admin</span>
        </div>
        <div className="w-9" />
      </div>

      {open && (
        <div
          className="sm:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className={`fixed inset-y-0 start-0 z-40 w-64 sm:w-56 bg-white dark:bg-zinc-900 border-e border-zinc-100 dark:border-zinc-800 flex flex-col transition-transform duration-200 ease-in-out
        ${open ? "translate-x-0" : "max-sm:ltr:-translate-x-full max-sm:rtl:translate-x-full"}`}>

        <div className="hidden sm:flex items-center gap-2 px-5 py-5 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-xl">🦷</span>
          <span className="font-bold text-zinc-900 dark:text-white">DentiCare Admin</span>
        </div>

        <div className="sm:hidden flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🦷</span>
            <span className="font-bold text-zinc-900 dark:text-white">DentiCare Admin</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="15" y2="15"/><line x1="15" y1="3" x2="3" y2="15"/>
            </svg>
          </button>
        </div>

        {navContent}
      </div>
    </>
  );
}
