"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { characters } from "@/lib/characters";
import { getLevelProgress, type LevelProgress } from "@/lib/levels";
import { FRAME_IMAGES } from "@/lib/frameImages";
import { BERRY_ICON } from "@/lib/iconImages";
import { formatBerry } from "@/lib/fusionTraits";
import { MODE_UPGRADE_CATALOG, MODE_UPGRADE_MAX_LEVEL, modeUpgradeBonusPercent, modeUpgradeCost } from "@/lib/modeUpgrades";
import { LoadingSpinner } from "./LoadingSpinner";
import { TCG_PENDING_REVEAL_KEY } from "./TcgBoard";
import {
  buyTcgPack,
  equipShopItem,
  fetchMyLevelInfo,
  fetchMyModeUpgradeLevels,
  fetchMyShopPurchases,
  fetchShopItems,
  getCurrentAuthUser,
  purchaseModeUpgrade,
  purchaseShopItem,
  setEquippedArena,
  setEquippedColor,
  setEquippedFrame,
  setEquippedTitle,
  type ShopItem,
} from "@/lib/supabase";

/** Cost of a Shop-bought TCG pack (migration 0029) — mirrors tcg_buy_pack()'s server-side check, just for display/disabling here. */
const TCG_PACK_COST = 200;

const CATEGORY_LABELS: Record<string, string> = {
  boost: "Modus-Verbesserungen",
  frame: "Profil-Rahmen",
  color: "Namensfarbe",
  avatar: "Avatare",
  title: "Titel",
  arena: "Duell-Arenen",
};

// Shop structure (Boss, 2026-10-14: "Shopstrukturen ein bisschen
// verbessern"): categories are grouped into a few tabs instead of one long
// stacked page, so the catalog can keep growing without endless scrolling.
// "upgrades" is a virtual category handled separately from shopItems (see
// below) — it's not a shop_items row, it's the per-mode level system.
type ShopTab = { id: string; label: string; categories: string[] };

const SHOP_TABS: ShopTab[] = [
  { id: "upgrades", label: "Spiel-Upgrades", categories: ["upgrades"] },
  { id: "tcg", label: "TCG-Packs", categories: ["tcg"] },
  { id: "boosts", label: "Boosts", categories: ["boost"] },
  { id: "cosmetics", label: "Rahmen & Titel", categories: ["frame", "title", "color"] },
  { id: "avatars", label: "Avatare", categories: ["avatar"] },
  { id: "arenas", label: "Arenen", categories: ["arena"] },
];

const CATEGORY_ORDER = ["frame", "color", "avatar", "title", "arena"];

/**
 * The Berry shop, split out from ProfileBoard into its own page (the
 * redesign kept it as a few sections buried at the bottom of Profile,
 * which no longer scales once the catalog grows past a couple dozen
 * items — see migration 0016's expansion). Equip/purchase logic is
 * unchanged, just lifted out so it can run standalone.
 */
export function ShopBoard() {
  const router = useRouter();
  const [tcgPackError, setTcgPackError] = useState("");
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [berries, setBerries] = useState(0);
  const [equippedFrame, setEquippedFrameState] = useState<string | null>(null);
  const [equippedColor, setEquippedColorState] = useState<string | null>(null);
  const [equippedTitle, setEquippedTitleState] = useState<string | null>(null);
  const [equippedArena, setEquippedArenaState] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState(SHOP_TABS[0].id);

  useEffect(() => {
    Promise.all([
      getCurrentAuthUser(),
      fetchMyLevelInfo(),
      fetchShopItems(),
      fetchMyShopPurchases(),
      fetchMyModeUpgradeLevels(),
    ]).then(([authUser, levelInfo, items, purchases, upgrades]) => {
      setProgress(getLevelProgress(levelInfo?.xp ?? 0));
      setBerries(levelInfo?.berries ?? 0);
      setEquippedFrameState(levelInfo?.equippedFrame ?? null);
      setEquippedColorState(levelInfo?.equippedColor ?? null);
      setEquippedTitleState(levelInfo?.equippedTitle ?? null);
      setEquippedArenaState(levelInfo?.equippedArena ?? null);
      setAvatarId(authUser?.avatarCharacterId ?? null);
      setShopItems(items);
      setOwnedItems(purchases);
      setUpgradeLevels(upgrades);
      setLoaded(true);
    });
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

  async function handleBuyTcgPack() {
    if (busyId) return;
    setTcgPackError("");
    setBusyId("tcg-pack");
    try {
      const result = await buyTcgPack();
      if (!result.ok) {
        setTcgPackError(result.error === "not_enough_berries" ? "Nicht genug Berries." : "Kauf hat nicht geklappt.");
        return;
      }
      setBerries((b) => b - TCG_PACK_COST);
      sessionStorage.setItem(TCG_PENDING_REVEAL_KEY, JSON.stringify({ cards: result.cards, fragmentsGained: result.fragmentsGained }));
      router.push("/tcg");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpgradePurchase(mode: string) {
    if (busyId) return;
    const level = upgradeLevels[mode] ?? 0;
    if (level >= MODE_UPGRADE_MAX_LEVEL) return;
    const cost = modeUpgradeCost(level);
    if (berries < cost) return;
    setBusyId(`upgrade:${mode}`);
    try {
      const ok = await purchaseModeUpgrade(mode);
      if (ok) {
        setUpgradeLevels((prev) => ({ ...prev, [mode]: level + 1 }));
        setBerries((b) => b - cost);
      }
    } finally {
      setBusyId(null);
    }
  }

  const tabsWithItems = SHOP_TABS.filter(
    (tab) => tab.id === "upgrades" || tab.id === "tcg" || tab.categories.some((cat) => shopItems.some((i) => i.category === cat))
  );
  const activeCategories = (tabsWithItems.find((t) => t.id === activeTab) ?? tabsWithItems[0])?.categories ?? [];
  const categories = CATEGORY_ORDER.filter((cat) => activeCategories.includes(cat) && shopItems.some((i) => i.category === cat));
  const boostItems = activeCategories.includes("boost") ? shopItems.filter((i) => i.category === "boost") : [];

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

      <div className="flex flex-wrap gap-1.5 border-b border-black/10 pb-3 dark:border-white/10">
        {tabsWithItems.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-accent text-white"
                : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/15"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "upgrades" && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
            Spiel-Upgrades
          </h2>
          <p className="mb-3 text-xs text-black/50 dark:text-white/40">
            Pro Spielmodus bis zu {MODE_UPGRADE_MAX_LEVEL} Stufen — jede weitere Stufe kostet mehr und bringt weniger
            als die letzte.
          </p>
          <div className="flex flex-col gap-2">
            {MODE_UPGRADE_CATALOG.map(({ mode, label, effect }) => {
              const level = upgradeLevels[mode] ?? 0;
              const maxed = level >= MODE_UPGRADE_MAX_LEVEL;
              const cost = maxed ? null : modeUpgradeCost(level);
              const currentBonus = Math.round(modeUpgradeBonusPercent(level));
              const nextBonus = maxed ? null : Math.round(modeUpgradeBonusPercent(level + 1));
              const affordable = cost !== null && berries >= cost;
              const effectLabel = effect === "fusion-tier" ? "bessere Chance auf S/A-Tier" : "XP & Berry";
              return (
                <div
                  key={mode}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
                >
                  <div>
                    <span className="font-semibold">{label}</span>{" "}
                    <span className="text-xs text-black/50 dark:text-white/40">
                      Stufe {level}/{MODE_UPGRADE_MAX_LEVEL} · +{currentBonus}% {effectLabel}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUpgradePurchase(mode)}
                    disabled={maxed || !affordable || busyId === `upgrade:${mode}`}
                    className={`rounded-md border px-3 py-1 text-xs font-medium ${
                      maxed
                        ? "cursor-not-allowed border-black/15 opacity-40 dark:border-white/15"
                        : affordable
                          ? "border-accent hover:bg-accent/10"
                          : "cursor-not-allowed border-black/15 opacity-40 dark:border-white/15"
                    }`}
                  >
                    {maxed ? "Maximale Stufe" : `Stufe ${level + 1} (+${nextBonus}%) · ${formatBerry(cost ?? 0)}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "tcg" && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">TCG-Packs</h2>
          <p className="mb-3 text-xs text-black/50 dark:text-white/40">
            Ein zusätzliches 5-Karten-Pack, gleiche Chancen wie das tägliche Pack — kauft nur mehr Versuche, keine
            besseren Chancen.
          </p>
          <button
            onClick={handleBuyTcgPack}
            disabled={busyId === "tcg-pack" || berries < TCG_PACK_COST}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm border-black/15 dark:border-white/15 ${
              berries < TCG_PACK_COST ? "opacity-40 cursor-not-allowed" : "hover:border-accent"
            }`}
          >
            TCG-Pack (5 Karten) · {formatBerry(TCG_PACK_COST)}
          </button>
          {tcgPackError && <p className="mt-2 text-xs text-danger">{tcgPackError}</p>}
        </div>
      )}

      {boostItems.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
            {CATEGORY_LABELS.boost}
          </h2>
          <p className="mb-2 text-xs text-black/50 dark:text-white/40">
            Permanente Spielverbesserung für deinen Account — einmal gekauft, immer aktiv.
          </p>
          <div className="flex flex-wrap gap-2">
            {boostItems.map((item) => {
              const owned = ownedItems.has(item.id);
              const isLocked = progress.level < item.minLevel;
              return (
                <button
                  key={item.id}
                  onClick={() => !isLocked && handleShopAction(item)}
                  disabled={isLocked || busyId === item.id}
                  className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm border-black/15 dark:border-white/15 ${
                    isLocked ? "opacity-40 cursor-not-allowed" : "hover:border-accent"
                  }`}
                >
                  {item.label}
                  {isLocked ? (
                    <span className="text-xs">(ab Lv. {item.minLevel})</span>
                  ) : (
                    <span className="text-xs">{owned ? "· aktiv" : `· ${formatBerry(item.price)}`}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
            <div className="flex flex-wrap gap-2">
              {items.map((item) => {
                const character = category === "avatar" ? characters.find((c) => c.id === item.id) : null;
                const owned = ownedItems.has(item.id);
                const isActive = currentlyEquipped[item.category] === item.id;
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
                        {owned ? (isActive ? "· ausgerüstet" : "· ausrüsten") : `· ${formatBerry(item.price)}`}
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
