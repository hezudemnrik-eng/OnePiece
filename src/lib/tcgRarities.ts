/**
 * Rarity metadata for the TCG mode (Boss, 2026-10-16/17) — 7 tiers from
 * Rekrut up to "God Tier", reusing the same Piraten-escalation vocabulary
 * as the account rank titles in src/lib/levels.ts (Boss asked for "eigene
 * Piraten-Begriffe, z.B. Rookie, Supernova, Yonko, God Tier").
 *
 * Colors/icons/hold-times are presentational only; the actual drop
 * weights and pity rule live server-side in tcg_open_daily_pack()
 * (migration 0027) so they can't be read off the client or spoofed.
 */
export type TcgRarity = "rekrut" | "pirat" | "kopfgeldjaeger" | "rookie" | "supernova" | "yonko" | "god_tier";

export type RarityMeta = {
  id: TcgRarity;
  label: string;
  order: number;
  icon: string;
  ringClass: string;
  textClass: string;
  glowClass: string;
  /** Chatti-designed frame overlay (true alpha PNG/WebP) drawn on top of the card art; null = no real frame yet, falls back to ringClass. */
  frameImage: string | null;
  /** Scale factor applied to frameImage so the painted border reaches past the art box edge (Boss, 2026-10-17: lower rarities need less overscan). */
  frameScale: number;
};

export const RARITIES: Record<TcgRarity, RarityMeta> = {
  rekrut: {
    id: "rekrut",
    label: "Rekrut",
    order: 1,
    icon: "⚪",
    ringClass: "ring-2 ring-slate-400",
    textClass: "text-slate-300",
    glowClass: "",
    frameImage: "/images/tcg/frame-rekrut.webp",
    frameScale: 1.05,
  },
  pirat: {
    id: "pirat",
    label: "Pirat",
    order: 2,
    icon: "🟢",
    ringClass: "ring-2 ring-emerald-500",
    textClass: "text-emerald-400",
    glowClass: "shadow-[0_0_10px_rgba(16,185,129,0.4)]",
    frameImage: "/images/tcg/frame-pirat.webp",
    frameScale: 1.1,
  },
  kopfgeldjaeger: {
    id: "kopfgeldjaeger",
    label: "Kopfgeldjäger",
    order: 3,
    icon: "🔵",
    ringClass: "ring-2 ring-sky-500",
    textClass: "text-sky-400",
    glowClass: "shadow-[0_0_13px_rgba(14,165,233,0.45)]",
    frameImage: "/images/tcg/frame-kopfgeldjaeger.webp",
    frameScale: 1.15,
  },
  rookie: {
    id: "rookie",
    label: "Rookie",
    order: 4,
    icon: "🟣",
    ringClass: "ring-2 ring-violet-500",
    textClass: "text-violet-400",
    glowClass: "shadow-[0_0_16px_rgba(139,92,246,0.5)]",
    frameImage: "/images/tcg/frame-rookie.webp",
    frameScale: 1.3,
  },
  supernova: {
    id: "supernova",
    label: "Supernova",
    order: 5,
    icon: "🟠",
    ringClass: "ring-2 ring-orange-500",
    textClass: "text-orange-400",
    glowClass: "shadow-[0_0_20px_rgba(249,115,22,0.6)]",
    frameImage: "/images/tcg/frame-supernova.webp",
    frameScale: 1.3,
  },
  yonko: {
    id: "yonko",
    label: "Yonko",
    order: 6,
    icon: "🔴",
    ringClass: "ring-2 ring-rose-600",
    textClass: "text-rose-400",
    glowClass: "shadow-[0_0_25px_rgba(225,29,72,0.7)]",
    frameImage: "/images/tcg/frame-yonko.webp",
    frameScale: 1.3,
  },
  god_tier: {
    id: "god_tier",
    label: "God Tier",
    order: 7,
    icon: "👑",
    ringClass: "ring-2 ring-[#f4c542]",
    textClass: "text-[#f4c542]",
    glowClass: "shadow-[0_0_32px_rgba(244,197,66,0.85)] op-s-tier-glow",
    frameImage: "/images/tcg/frame-god-tier.webp",
    frameScale: 1.3,
  },
};

export const RARITY_ORDER: TcgRarity[] = ["rekrut", "pirat", "kopfgeldjaeger", "rookie", "supernova", "yonko", "god_tier"];

/** How long the reveal animation holds on each card before the next one can flip, scaled by rarity (Q42/Q48: niedrige Raritäten schnell, God Tier darf 4+ Sekunden dauern). */
export function revealHoldMs(rarity: TcgRarity): number {
  switch (rarity) {
    case "god_tier":
      return 4200;
    case "yonko":
      return 2000;
    case "supernova":
      return 1300;
    case "rookie":
      return 900;
    case "kopfgeldjaeger":
      return 700;
    case "pirat":
      return 500;
    default:
      return 400;
  }
}
