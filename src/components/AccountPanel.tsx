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
import { COSMETIC_FRAMES } from "@/lib/levels";
import { formatBerry } from "@/lib/fusionTraits";

type Props = {
  /** Called after a successful logout so the parent (AuthGate) can re-check auth state. */
  onSignedOut?: () => void;
};

export function AccountPanel({ onSignedOut }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [frameClass, setFrameClass] = useState("");
  const [colorClass, setColorClass] = useState("");
  const [berries, setBerries] = useState(0);
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
      setColorClass(items.find((i) => i.category === "color" && i.id === levelInfo?.equippedColor)?.className ?? "");
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

  const avatar = user.avatarCharacterId ? characters.find((c) => c.id === user.avatarCharacterId) : null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => setAnimationsEnabled(!animationsEnabled)}
        title={animationsEnabled ? "Animationen & Sound ausschalten" : "Animationen & Sound einschalten"}
        className="text-base"
      >
        {animationsEnabled ? "✨" : "🔇"}
      </button>
      {avatar?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar.imageUrl}
          alt={avatar.name}
          referrerPolicy="no-referrer"
          className={`h-7 w-7 rounded-full object-cover object-top border border-black/10 dark:border-white/10 ${frameClass}`}
        />
      )}
      <span>
        <span className={`font-semibold ${colorClass}`}>{user.username}</span>
        {user.isAdmin && <span className="ml-1 text-xs text-amber-600">(Admin)</span>}
      </span>
      <span className="text-black/50 dark:text-white/40">{formatBerry(berries)}</span>
      <Link href="/profil" className="text-black/50 dark:text-white/40 hover:underline">
        Profil
      </Link>
      <button onClick={handleLogout} className="text-black/50 dark:text-white/40 hover:underline">
        Abmelden
      </button>
    </div>
  );
}
