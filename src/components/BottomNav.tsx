"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODES, MODE_GROUPS, SHOP_TILE } from "@/lib/modes";
import { ICON_IMAGES } from "@/lib/iconImages";

function NavIcon({ icon }: { icon: string }) {
  const image = ICON_IMAGES[icon];
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" aria-hidden className="h-7 w-7 object-contain" />;
  }
  return (
    <span className="text-lg" aria-hidden>
      {icon}
    </span>
  );
}

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
      className="md:hidden fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-black/10 dark:border-white/10 bg-cover bg-center"
      style={{ backgroundImage: "url('/images/bar-bottomnav.png')", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <Link
        href="/"
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
          pathname === "/" ? "text-accent-ink" : "text-black/50 dark:text-white/40"
        }`}
      >
        <NavIcon icon="🏠" />
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
            <NavIcon icon={g.icon} />
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
        <NavIcon icon={SHOP_TILE.icon} />
        {SHOP_TILE.title}
      </Link>
    </nav>
  );
}
