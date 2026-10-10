"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/book", label: "Book" },
  { href: "/my-bookings", label: "My bookings" },
  { href: "/owner", label: "Owner" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-xs text-white">24/7</span>
          <span className="hidden sm:inline">Rentals &amp; Tours</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {LINKS.map((l) => {
            const active = path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 font-medium ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
