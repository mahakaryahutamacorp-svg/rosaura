"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SideNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm transition ${
              active ? "bg-champagne font-semibold text-ink" : "text-brown hover:bg-white/70"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
