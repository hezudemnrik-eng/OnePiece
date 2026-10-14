"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODE_GROUPS, MODES, SHOP_TILE } from "@/lib/modes";
import { ICON_IMAGES } from "@/lib/iconImages";

function isGroupActive(pathname: string, groupHref: string, groupId: string): boolean {
  if (pathname === groupHref) return true;
  return MODES.some((m) => m.group === groupId && pathname.startsWith(m.href));
}

/** Collapsible icon-only sidebar for desktop (Q58) — replaces the old hamburger+drawer SidebarNav. */
export function IconRail() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  const items: { href: string; icon: string; title: string; id?: string }[] = [
    { href: "/", icon: "🏠", title: "Home" },
    ...MODE_GROUPS,
    SHOP_TILE,
  ];

  return (
    <nav
      className={`hidden md:flex fixed inset-y-0 left-0 z-20 flex-col border-r border-black/10 dark:border-white/10 bg-[var(--background)]/95 backdrop-blur py-4 transition-all ${
        expanded ? "w-48" : "w-16"
      }`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Navigation einklappen" : "Navigation ausklappen"}
        className="mb-4 self-center text-lg leading-none text-black/50 dark:text-white/40 hover:text-accent-ink"
      >
        {expanded ? "«" : "»"}
      </button>
      <div className="flex flex-col gap-1 px-2">
        {items.map((item) => {
          const active = item.id ? isGroupActive(pathname, item.href, item.id) : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.title}
              className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium ${
                active ? "bg-accent/10 text-accent-ink" : "text-black/60 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {ICON_IMAGES[item.icon] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ICON_IMAGES[item.icon]} alt="" aria-hidden className="h-11 w-11 shrink-0 object-contain" />
              ) : (
                <span className="text-2xl shrink-0" aria-hidden>
                  {item.icon}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
