"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMyLevelInfo, getCurrentAuthUser, isSupabaseConfigured, signOutUser, type AuthUser } from "@/lib/supabase";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { BERRY_ICON, LOGOUT_ICON } from "@/lib/iconImages";

type Props = {
  /** Called after a successful logout so the parent (AuthGate) can re-check auth state. */
  onSignedOut?: () => void;
};

/**
 * Header-only account widget: Berry count + Logout. The avatar/frame/title/
 * username block that used to live here moved entirely to the home screen's
 * profile hero (HomeOverview, PR #51) — Boss wants the header kept to the
 * logo, with "Profil" only in that menu now.
 *
 * Below the `sm` breakpoint this sits on the blank wooden sign painted into
 * the right side of header-banner.png (Boss's Chatti asset, ~85x30px at
 * typical phone widths) — far smaller than this panel's `sm:`-and-up
 * header-bar sizing, so every element defaults to a compact size and only
 * grows back to its original size at `sm:`.
 */
export function AccountPanel({ onSignedOut }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [berries, setBerries] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useAnimationsEnabled();

  useEffect(() => {
    Promise.all([getCurrentAuthUser(), fetchMyLevelInfo()]).then(([u, levelInfo]) => {
      setUser(u);
      setBerries(levelInfo?.berries ?? 0);
      setLoaded(true);
    });
  }, []);

  if (!isSupabaseConfigured() || !loaded || !user) return null;

  async function handleLogout() {
    await signOutUser();
    setUser(null);
    onSignedOut?.();
  }

  return (
    <div className="flex min-w-0 items-center gap-1 text-sm sm:gap-3">
      <button
        onClick={() => setAnimationsEnabled(!animationsEnabled)}
        title={animationsEnabled ? "Animationen & Sound ausschalten" : "Animationen & Sound einschalten"}
        className="hidden shrink-0 text-base sm:inline"
      >
        {animationsEnabled ? "✨" : "🔇"}
      </button>
      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap font-display tabular-nums text-accent-ink text-[11px] sm:text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BERRY_ICON} alt="" aria-hidden className="h-3 w-3 object-contain drop-shadow-sm sm:h-4 sm:w-4" />
        {berries.toLocaleString("de-DE")}
      </span>
      <Link
        href="/shop"
        title="Berries kaufen"
        aria-label="Berries kaufen"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-ink/90 text-[11px] font-bold leading-none text-poster-ink shadow-sm sm:h-6 sm:w-6 sm:text-sm"
      >
        +
      </Link>
      <button
        onClick={handleLogout}
        title="Abmelden"
        aria-label="Abmelden"
        className="shrink-0 text-black/50 dark:text-white/40 hover:underline"
      >
        <span className="sm:hidden" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGOUT_ICON} alt="" className="h-4 w-4 object-contain drop-shadow-md" />
        </span>
        <span className="hidden sm:inline">Abmelden</span>
      </button>
    </div>
  );
}
