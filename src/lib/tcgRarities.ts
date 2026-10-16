/**
 * Rarity metadata for the TCG mode (Boss, 2026-10-16) — one entry per tier
 * from Common up to "God Tier". Kept in code (not DB) since it's small and
 * purely presentational; the actual drop weights live server-side in
 * tcg_open_daily_pack() (migration 0027) so they can't be read off the
 * client or spoofed.
 *
 * Colors/labels are a first guess pending Boss's answers in the TCG
 * questionnaire — easy to retune here without touching the DB or the
 * board component.
 */
export type TcgRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "god_tier";

export type RarityMeta = {
  id: TcgRarity;
  label: string;
  order: number;
  /** Border/ring color for the card frame placeholder. */
  ringClass: string;
  textClass: string;
  glowClass: string;
};

export const RARITIES: Record<TcgRarity, RarityMeta> = {
  common: {
    id: "common",
    label: "Common",
    order: 1,
    ringClass: "ring-2 ring-slate-400",
    textClass: "text-slate-300",
    glowClass: "",
  },
  uncommon: {
    id: "uncommon",
    label: "Uncommon",
    order: 2,
    ringClass: "ring-2 ring-emerald-500",
    textClass: "text-emerald-400",
    glowClass: "shadow-[0_0_10px_rgba(16,185,129,0.4)]",
  },
  rare: {
    id: "rare",
    label: "Rare",
    order: 3,
    ringClass: "ring-2 ring-sky-500",
    textClass: "text-sky-400",
    glowClass: "shadow-[0_0_14px_rgba(14,165,233,0.5)]",
  },
  epic: {
    id: "epic",
    label: "Epic",
    order: 4,
    ringClass: "ring-2 ring-purple-500",
    textClass: "text-purple-400",
    glowClass: "shadow-[0_0_18px_rgba(168,85,247,0.6)]",
  },
  legendary: {
    id: "legendary",
    label: "Legendary",
    order: 5,
    ringClass: "ring-2 ring-orange-500",
    textClass: "text-orange-400",
    glowClass: "shadow-[0_0_22px_rgba(249,115,22,0.7)]",
  },
  god_tier: {
    id: "god_tier",
    label: "God Tier",
    order: 6,
    ringClass: "ring-2 ring-[#f4c542]",
    textClass: "text-[#f4c542]",
    glowClass: "shadow-[0_0_30px_rgba(244,197,66,0.85)] op-s-tier-glow",
  },
};

export const RARITY_ORDER: TcgRarity[] = ["common", "uncommon", "rare", "epic", "legendary", "god_tier"];

/** How long the reveal animation holds on each card before the next one can flip, scaled by rarity (Q: niedrige Raritäten schnell, seltene länger). */
export function revealHoldMs(rarity: TcgRarity): number {
  switch (rarity) {
    case "god_tier":
      return 2200;
    case "legendary":
      return 1600;
    case "epic":
      return 1100;
    case "rare":
      return 800;
    default:
      return 500;
  }
}
