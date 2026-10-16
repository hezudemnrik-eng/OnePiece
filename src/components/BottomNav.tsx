"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODES } from "@/lib/modes";
import { ICON_IMAGES } from "@/lib/iconImages";

function NavIcon({ icon }: { icon: string }) {
  const image = ICON_IMAGES[icon];
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" aria-hidden className="h-16 w-16 object-contain drop-shadow-md" />;
  }
  return (
    <span className="text-6xl drop-shadow-md" aria-hidden>
      {icon}
    </span>
  );
}

function isGroupActive(pathname: string, groupHref: string, groupId: string): boolean {
  if (pathname === groupHref) return true;
  return MODES.some((m) => m.group === groupId && pathname.startsWith(m.href));
}

/** Gold "lit coin" highlight behind the active icon. Sized to stay inside
 * each slot (not wider than flex-1's share at phone widths) so the
 * highlight never bleeds into a neighboring icon. */
function navSlotClass(active: boolean): string {
  return `flex items-center justify-center rounded-xl p-0.5 transition ${
    active ? "bg-[rgba(244,197,66,0.35)] shadow-[0_0_0_2px_rgba(244,197,66,0.65)]" : ""
  }`;
}

/**
 * Bottom-bar entries, per Boss's full-app mockup (2026-10-15): Home, Kampf,
 * Quests (Tagesquest/Questbuch), Ranking and Shop, each with a text label.
 * "Builder" no longer gets its own bottom-nav slot (it's still reachable
 * from the Home grid tile) and "Rätsel & Ranking" splits into its own
 * Quests and Ranking entries to match the mockup's 5 labelled icons.
 */
const NAV_ITEMS: { href: string; icon: string; label: string; isActive: (pathname: string) => boolean }[] = [
  { href: "/", icon: "🏠", label: "Home", isActive: (p) => p === "/" },
  { href: "/kampf", icon: "⚔️", label: "Kampf", isActive: (p) => isGroupActive(p, "/kampf", "kampf") },
  { href: "/questbuch", icon: "📖", label: "Quests", isActive: (p) => p === "/questbuch" },
  { href: "/raetsel-ranking", icon: "👑", label: "Ranking", isActive: (p) => isGroupActive(p, "/raetsel-ranking", "raetsel-ranking") },
  { href: "/shop", icon: "🛒", label: "Shop", isActive: (p) => p.startsWith("/shop") },
];

/** Fixed bottom bar for mobile (Q51). */
export function BottomNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // The nav is `fixed`, so page content needs matching bottom padding
  // reserved or it renders underneath it — including the fixed nav's own
  // hit area, which then silently eats clicks meant for whatever sits in
  // that overlap (e.g. Fusion Pirates' "Neuen Fusions-Piraten würfeln").
  // That padding (see AuthGate) used to be a value hand-picked to match
  // this bar's height; PR #97 grew the icons/label without updating it,
  // so it drifted out of sync. Publishing the bar's real measured height
  // as a CSS variable keeps the two in lockstep regardless of future
  // size changes here.
  useLayoutEffect(() => {
    function recalc() {
      // Mirrors the md:hidden breakpoint below: above it this bar renders
      // display:none (offsetHeight 0 already), but pin it explicitly so a
      // stale mobile measurement never lingers across a resize.
      const height = window.innerWidth >= 768 ? 0 : navRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty("--bottom-nav-height", `${height}px`);
    }
    recalc();
    const ro = new ResizeObserver(recalc);
    if (navRef.current) ro.observe(navRef.current);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, []);

  return (
    <nav
      id="app-bottomnav"
      ref={navRef}
      className="md:hidden fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around bg-cover bg-center shadow-[0_-2px_4px_rgba(0,0,0,0.35)]"
      style={{ backgroundImage: "url('/images/bar-bottomnav.png')", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
        >
          <span className={navSlotClass(item.isActive(pathname))}>
            <NavIcon icon={item.icon} />
          </span>
          <span className="truncate whitespace-nowrap text-sm font-medium text-white/90 drop-shadow-md">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
