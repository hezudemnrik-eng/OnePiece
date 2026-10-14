"use client";

import { useEffect, useState } from "react";
import { characters } from "@/lib/characters";
import { getLevelProgress, type LevelProgress } from "@/lib/levels";
import { FRAME_IMAGES } from "@/lib/frameImages";
import { BERRY_ICON } from "@/lib/iconImages";
import { formatBerry } from "@/lib/fusionTraits";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  equipShopItem,
  fetchMyLevelInfo,
  fetchMyShopPurchases,
  fetchShopItems,
  getCurrentAuthUser,
  purchaseShopItem,
  setEquippedArena,
  setEquippedColor,
  setEquippedFrame,
  setEquippedTitle,
  type ShopItem,
} from "@/lib/supabase";

const CATEGORY_LABELS: Record<string, string> = {
  boost: "Modus-Verbesserungen",
  frame: "Profil-Rahmen",
  color: "Namensfarbe",
  avatar: "Avatare",
  title: "Titel",
  arena: "Duell-Arenen",
};

const CATEGORY_ORDER = ["boost", "frame", "color", "avatar", "title", "arena"];

/**
 * The Berry shop, split out from ProfileBoard into its own page (the
 * redesign kept it as a few sections buried at the bottom of Profile,
 * which no longer scales once the catalog grows past a couple dozen
 * items — see migration 0016's expansion). Equip/purchase logic is
 * unchanged, just lifted out so it can run standalone.
 */
export function ShopBoard() {
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [berries, setBerries] = useState(0);
  const [equippedFrame, setEquippedFrameState] = useState<string | null>(null);
  const [equippedColor, setEquippedColorState] = useState<string | null>(null);
  const [equippedTitle, setEquippedTitleState] = useState<string | null>(null);
  const [equippedArena, setEquippedArenaState] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getCurrentAuthUser(), fetchMyLevelInfo(), fetchShopItems(), fetchMyShopPurchases()]).then(
      ([authUser, levelInfo, items, purchases]) => {
        setProgress(getLevelProgress(levelInfo?.xp ?? 0));
        setBerries(levelInfo?.berries ?? 0);
        setEquippedFrameState(levelInfo?.equippedFrame ?? null);
        setEquippedColorState(levelInfo?.equippedColor ?? null);
        setEquippedTitleState(levelInfo?.equippedTitle ?? null);
        setEquippedArenaState(levelInfo?.equippedArena ?? null);
        setAvatarId(authUser?.avatarCharacterId ?? null);
        setShopItems(items);
        setOwnedItems(purchases);
        setLoaded(true);
      }
    );
  }, []);

  if (!loaded || !progress) {
    return <LoadingSpinner label="Lade Shop…" />;
  }

  const currentlyEquipped: Record<string, string | null> = {
    frame: equippedFrame,
    color: equippedColor,
    title: equippedTitle,
    arena: equippedArena,
    avatar: avatarId,
  };

  async function handleShopAction(item: ShopItem) {
    if (busyId) return;
    const owned = ownedItems.has(item.id);
    // Avatars always have *some* value equipped (the free picker on the
    // Profile page provides the fallback), so clicking an owned avatar
    // item re-equips it rather than toggling it off like the rest can.
    const isEquipped = item.category !== "avatar" && currentlyEquipped[item.category] === item.id;
    setBusyId(item.id);
    try {
      if (!owned) {
        const ok = await purchaseShopItem(item.id);
        if (ok) {
          setOwnedItems((prev) => new Set(prev).add(item.id));
          setBerries((b) => b - item.price);
        }
        return;
      }
      // Boosts are passive, always-on gameplay perks once owned — nothing to equip/unequip.
      if (item.category === "boost") return;
      if (isEquipped) {
        if (item.category === "frame") {
          setEquippedFrameState(null);
          await setEquippedFrame(null);
        } else if (item.category === "color") {
          setEquippedColorState(null);
          await setEquippedColor(null);
        } else if (item.category === "title") {
          setEquippedTitleState(null);
          await setEquippedTitle(null);
        } else if (item.category === "arena") {
          setEquippedArenaState(null);
          await setEquippedArena(null);
        }
        return;
      }
      const ok = await equipShopItem(item.id);
      if (ok) {
        if (item.category === "frame") setEquippedFrameState(item.id);
        else if (item.category === "color") setEquippedColorState(item.id);
        else if (item.category === "title") setEquippedTitleState(item.id);
        else if (item.category === "arena") setEquippedArenaState(item.id);
        else if (item.category === "avatar") setAvatarId(item.id);
      }
    } finally {
      setBusyId(null);
    }
  }

  const categories = CATEGORY_ORDER.filter((cat) => shopItems.some((i) => i.category === cat));

  return (
    <div className="flex flex-col gap-8">
      <div className="op-wanted op-parchment flex items-center justify-between rounded-xl p-4">
        <span className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
          Dein Guthaben
        </span>
        <p className="flex items-center gap-1.5 font-[family-name:var(--font-display)] text-xl whitespace-nowrap text-accent-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BERRY_ICON} alt="" aria-hidden className="h-7 w-7 object-contain drop-shadow-md" />
          {formatBerry(berries)}
        </p>
      </div>

      {categories.map((category) => {
        const items = shopItems.filter((i) => i.category === category);
        return (
          <div key={category}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            {category === "arena" && (
              <p className="mb-2 text-xs text-black/50 dark:text-white/40">
                Rein kosmetisch — färbt den Hintergrund im Duell-Ergebnis ein.
              </p>
            )}
            {category === "boost" && (
              <p className="mb-2 text-xs text-black/50 dark:text-white/40">
                Permanente Spielverbesserung für deinen Account — einmal gekauft, immer aktiv.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {items.map((item) => {
                const character = category === "avatar" ? characters.find((c) => c.id === item.id) : null;
                const owned = ownedItems.has(item.id);
                const isActive = category !== "boost" && currentlyEquipped[item.category] === item.id;
                const isLocked = progress.level < item.minLevel;
                return (
                  <button
                    key={item.id}
                    onClick={() => !isLocked && handleShopAction(item)}
                    disabled={isLocked || busyId === item.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${category === "frame" ? "" : item.className} ${
                      isActive ? "border-accent bg-accent/10 font-semibold" : "border-black/15 dark:border-white/15"
                    } ${isLocked ? "opacity-40 cursor-not-allowed" : "hover:border-accent"}`}
                  >
                    {character?.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={character.imageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-6 w-6 rounded-full object-cover object-top"
                      />
                    )}
                    {category === "frame" && FRAME_IMAGES[item.id] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={FRAME_IMAGES[item.id]} alt="" aria-hidden className="h-8 w-8 object-contain" />
                    )}
                    {item.label}
                    {isLocked ? (
                      <span className="text-xs">(ab Lv. {item.minLevel})</span>
                    ) : (
                      <span className="text-xs">
                        {owned
                          ? category === "boost"
                            ? "· aktiv"
                            : isActive
                              ? "· ausgerüstet"
                              : "· ausrüsten"
                          : `· ${formatBerry(item.price)}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
