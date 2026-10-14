"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { characters } from "@/lib/characters";
import {
  fetchMyLevelInfo,
  fetchShopItems,
  getCurrentAuthUser,
  isSupabaseConfigured,
  signOutUser,
  type AuthUser,
} from "@/lib/supabase";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { COSMETIC_FRAMES, getLevelProgress } from "@/lib/levels";
import { FRAME_IMAGES } from "@/lib/frameImages";
import { BERRY_ICON, LOGOUT_ICON } from "@/lib/iconImages";

type Props = {
  /** Called after a successful logout so the parent (AuthGate) can re-check auth state. */
  onSignedOut?: () => void;
};

export function AccountPanel({ onSignedOut }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [frameClass, setFrameClass] = useState("");
  const [frameImage, setFrameImage] = useState<string | null>(null);
  const [colorClass, setColorClass] = useState("");
  const [title, setTitle] = useState<{ label: string; className: string } | null>(null);
  const [berries, setBerries] = useState(0);
  const [level, setLevel] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useAnimationsEnabled();

  useEffect(() => {
    Promise.all([getCurrentAuthUser(), fetchMyLevelInfo(), fetchShopItems()]).then(([u, levelInfo, items]) => {
      setUser(u);
      setFrameClass(
        COSMETIC_FRAMES.find((f) => f.id === levelInfo?.equippedFrame)?.className ??
          items.find((i) => i.category === "frame" && i.id === levelInfo?.equippedFrame)?.className ??
          ""
      );
      setFrameImage(levelInfo?.equippedFrame ? (FRAME_IMAGES[levelInfo.equippedFrame] ?? null) : null);
      setColorClass(items.find((i) => i.category === "color" && i.id === levelInfo?.equippedColor)?.className ?? "");
      const activeTitle = items.find((i) => i.category === "title" && i.id === levelInfo?.equippedTitle);
      setTitle(activeTitle ? { label: activeTitle.label, className: activeTitle.className } : null);
      setBerries(levelInfo?.berries ?? 0);
      setLevel(getLevelProgress(levelInfo?.xp ?? 0).level);
      setLoaded(true);
    });
  }, []);

  if (!isSupabaseConfigured() || !loaded || !user) return null;

  async function handleLogout() {
    await signOutUser();
    setUser(null);
    onSignedOut?.();
  }

  const avatar = user.avatarCharacterId ? characters.find((c) => c.id === user.avatarCharacterId) : null;

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm sm:gap-2">
      <button
        onClick={() => setAnimationsEnabled(!animationsEnabled)}
        title={animationsEnabled ? "Animationen & Sound ausschalten" : "Animationen & Sound einschalten"}
        className="hidden shrink-0 text-base sm:inline"
      >
        {animationsEnabled ? "✨" : "🔇"}
      </button>
      <Link href="/profil" className="relative shrink-0">
        {frameImage ? (
          <span className="relative flex h-16 w-16 items-center justify-center">
            {avatar?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar.imageUrl}
                alt={avatar.name}
                referrerPolicy="no-referrer"
                className="h-11 w-11 rounded-full object-cover object-top"
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frameImage} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
          </span>
        ) : (
          avatar?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar.imageUrl}
              alt={avatar.name}
              referrerPolicy="no-referrer"
              className={`h-11 w-11 rounded-full object-cover object-top border-2 border-foreground ${frameClass}`}
            />
          )
        )}
        <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold tabular-nums text-poster-ink">
          {level}
        </span>
      </Link>
      {/* Username/Admin-Badge nur ab sm — auf dem Handy drängte das sonst
          Berry-Anzeige und Abmelden-Button aus dem sichtbaren Header (Q143). */}
      <span className="hidden min-w-0 truncate whitespace-nowrap sm:inline">
        <span className={`font-semibold ${colorClass}`}>{user.username}</span>
        {user.isAdmin && <span className="ml-1 text-xs text-accent-ink">(Admin)</span>}
        {title && <span className={`ml-1.5 text-xs opacity-70 ${title.className}`}>{title.label}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap font-display tabular-nums text-accent-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BERRY_ICON} alt="" aria-hidden className="h-4 w-4 object-contain drop-shadow-sm" />
        {berries.toLocaleString("de-DE")}
      </span>
      <Link href="/profil" className="hidden shrink-0 text-black/50 dark:text-white/40 hover:underline sm:inline">
        Profil
      </Link>
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
