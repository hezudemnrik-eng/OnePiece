"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODES, MODE_GROUPS, SHOP_TILE } from "@/lib/modes";
import { ICON_IMAGES } from "@/lib/iconImages";

function NavIcon({ icon }: { icon: string }) {
  const image = ICON_IMAGES[icon];
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" aria-hidden className="h-16 w-16 object-contain drop-shadow-md" />;
  }
  return (
    <span className="text-4xl drop-shadow-md" aria-hidden>
      {icon}
    </span>
  );
}

function isGroupActive(pathname: string, groupHref: string, groupId: string): boolean {
  if (pathname === groupHref) return true;
  return MODES.some((m) => m.group === groupId && pathname.startsWith(m.href));
}

/** Gold "lit coin" highlight behind the active icon — the only active/inactive
 * cue now that the text labels are gone (Q163, bigger icons without names). */
function navSlotClass(active: boolean): string {
  return `flex items-center justify-center rounded-xl p-2 transition ${
    active ? "bg-[rgba(244,197,66,0.35)] shadow-[0_0_0_2px_rgba(244,197,66,0.65)]" : ""
  }`;
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
      className="md:hidden fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around bg-cover bg-center shadow-[0_-2px_4px_rgba(0,0,0,0.35)]"
      style={{ backgroundImage: "url('/images/bar-bottomnav.png')", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <Link href="/" title="Home" className="flex flex-1 items-center justify-center py-2">
        <span className={navSlotClass(pathname === "/")}>
          <NavIcon icon="🏠" />
        </span>
      </Link>
      {MODE_GROUPS.map((g) => {
        const active = isGroupActive(pathname, g.href, g.id);
        return (
          <Link key={g.id} href={g.href} title={g.title} className="flex flex-1 items-center justify-center py-2">
            <span className={navSlotClass(active)}>
              <NavIcon icon={g.icon} />
            </span>
          </Link>
        );
      })}
      <Link href={SHOP_TILE.href} title={SHOP_TILE.title} className="flex flex-1 items-center justify-center py-2">
        <span className={navSlotClass(pathname.startsWith(SHOP_TILE.href))}>
          <NavIcon icon={SHOP_TILE.icon} />
        </span>
      </Link>
    </nav>
  );
}
