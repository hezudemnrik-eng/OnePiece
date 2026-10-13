"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODES, MODE_GROUPS, SHOP_TILE } from "@/lib/modes";

function isGroupActive(pathname: string, groupHref: string, groupId: string): boolean {
  if (pathname === groupHref) return true;
  return MODES.some((m) => m.group === groupId && pathname.startsWith(m.href));
}

/**
 * Fixed bottom bar for mobile (Q51) — Home + the 3 mode categories (Q52) +
 * Shop as its own 5th slot (requested alongside the Shop redesign — Profil
 * still stays header-avatar-only, Q59).
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-black/10 dark:border-white/10 bg-[var(--background)]/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <Link
        href="/"
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
          pathname === "/" ? "text-accent-ink" : "text-black/50 dark:text-white/40"
        }`}
      >
        <span className="text-lg" aria-hidden>
          🏠
        </span>
        Home
      </Link>
      {MODE_GROUPS.map((g) => {
        const active = isGroupActive(pathname, g.href, g.id);
        return (
          <Link
            key={g.id}
            href={g.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              active ? "text-accent-ink" : "text-black/50 dark:text-white/40"
            }`}
          >
            <span className="text-lg" aria-hidden>
              {g.icon}
            </span>
            {g.title}
          </Link>
        );
      })}
      <Link
        href={SHOP_TILE.href}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
          pathname.startsWith(SHOP_TILE.href) ? "text-accent-ink" : "text-black/50 dark:text-white/40"
        }`}
      >
        <span className="text-lg" aria-hidden>
          {SHOP_TILE.icon}
        </span>
        {SHOP_TILE.title}
      </Link>
    </nav>
  );
}
