"use client";

import { useEffect, useState } from "react";
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
    <div className="flex min-w-0 items-center gap-2 text-sm sm:gap-3">
      <button
        onClick={() => setAnimationsEnabled(!animationsEnabled)}
        title={animationsEnabled ? "Animationen & Sound ausschalten" : "Animationen & Sound einschalten"}
        className="hidden shrink-0 text-base sm:inline"
      >
        {animationsEnabled ? "✨" : "🔇"}
      </button>
      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap font-display tabular-nums text-accent-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BERRY_ICON} alt="" aria-hidden className="h-4 w-4 object-contain drop-shadow-sm" />
        {berries.toLocaleString("de-DE")}
      </span>
      <button
        onClick={handleLogout}
        title="Abmelden"
        aria-label="Abmelden"
        className="shrink-0 text-black/50 dark:text-white/40 hover:underline"
      >
        <span className="sm:hidden" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGOUT_ICON} alt="" className="h-10 w-10 object-contain drop-shadow-md" />
        </span>
        <span className="hidden sm:inline">Abmelden</span>
      </button>
    </div>
  );
}
