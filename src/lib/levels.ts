// Account-wide XP/level/rank math. Pure functions over the raw `xp` total
// stored on the profile row — tune the curve or rank table here without
// touching the database.

export type RankTier = {
  minLevel: number;
  title: string;
};

// One-Piece-flavored rank titles, loosely following the series' own
// escalation (unranked pirate -> Rookie -> Supernova -> Yonko-adjacent).
const RANK_TIERS: RankTier[] = [
  { minLevel: 1, title: "Rekrut" },
  { minLevel: 5, title: "Pirat" },
  { minLevel: 10, title: "Kopfgeldjäger" },
  { minLevel: 15, title: "Rookie" },
  { minLevel: 20, title: "Supernova" },
  { minLevel: 30, title: "Kommandant" },
  { minLevel: 40, title: "Yonko" },
  { minLevel: 60, title: "Piratenkönig" },
];

/** Cumulative XP needed to REACH a given level (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 35 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function rankTitleForLevel(level: number): string {
  let title = RANK_TIERS[0].title;
  for (const tier of RANK_TIERS) {
    if (level >= tier.minLevel) title = tier.title;
  }
  return title;
}

export type LevelProgress = {
  level: number;
  rankTitle: string;
  xp: number;
  /** XP at the start of the current level. */
  levelStartXp: number;
  /** XP required to reach the next level. */
  levelEndXp: number;
  /** 0-1 progress through the current level. */
  progress: number;
};

export function getLevelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const levelStartXp = xpForLevel(level);
  const levelEndXp = xpForLevel(level + 1);
  const span = levelEndXp - levelStartXp;
  const progress = span > 0 ? Math.min(1, Math.max(0, (xp - levelStartXp) / span)) : 1;
  return { level, rankTitle: rankTitleForLevel(level), xp, levelStartXp, levelEndXp, progress };
}

// Kept in sync with daily_xp_cap() in migration 0011 — the actual
// enforcement is server-side (can't be bypassed from the client), this is
// just for anything that wants to reference the same number.
export const DAILY_XP_CAP = 400;

// Modes subject to diminishing returns on repeats (see award_xp() in
// migration 0011) — flat-XP modes with no real win/loss or skill signal.
export const FARMABLE_MODES = ["crew", "blind-ranking"] as const;

// Kept in sync with berry_per_level()/achievement_berry_bonus() in
// migration 0012 — the actual Berry awards happen server-side.
export const BERRY_PER_LEVEL = 50;
export const ACHIEVEMENT_BERRY_BONUS = 100;

// Flat/scaled XP awards per completed action across the app. Boosted
// (Boss, 2026-10-14: "Das spielen soll auch mehr Xp geben") — the daily
// cap and level curve from migration 0011 are unchanged, so this mainly
// means fewer runs needed to fill a day's budget, not a redesign of it.
export const XP_MATCH_WIN = 40;
export const XP_MATCH_LOSS = 15;
export const XP_QUIZ_BASE = 8;
export const XP_QUIZ_PER_CORRECT = 2;
export const XP_CREW_COMPLETE = 18;
export const XP_BLIND_RANKING_COMPLETE = 18;
export const XP_FUSION_BASE = 15;
export const XP_ACHIEVEMENT_BONUS = 20;
// Duell-Board previously awarded no mode XP at all (migration 0021).
export const XP_DUEL_COMPLETE = 20;

// Kept in sync with berry_per_mode_run() in migration 0021 — the actual
// award (and its mode-upgrade multiplier) happens server-side in award_xp().
export const BERRY_PER_MODE_RUN = 15;

// Kept in sync with daily_quest_xp_bonus()/daily_quest_berry_bonus() in
// migration 0020 — the actual award happens server-side via claim_daily_quest().
// Deliberately higher than a single normal run's XP so the daily quest feels
// worth doing (Boss, 2026-10-14: "mehr XP und Berries für die Tagesquest").
export const DAILY_QUEST_XP_BONUS = 60;
export const DAILY_QUEST_BERRY_BONUS = 80;

/** Fusions-Pirat XP scales with the bounty: +1 XP per 100M Berry, capped. */
export function fusionXpForBounty(bounty: number): number {
  return XP_FUSION_BASE + Math.min(50, Math.floor(bounty / 100_000_000));
}

export type CosmeticFrame = {
  id: string;
  label: string;
  minLevel: number;
  /** Tailwind border/shadow classes applied as a CSS fallback around the
   *  square profile-hero card (see RANK_FRAME_IMAGES for the illustrated
   *  artwork that replaces this once Boss has painted it). */
  className: string;
};

/**
 * Rank frames, unlocked one per RANK_TIERS milestone (Boss, 2026-10-14:
 * "mehr davon" — expanded from 5 to 8 tiers, one per account rank). These
 * used to ring the round avatar; they now decorate the square profile-hero
 * card instead (profiles.equipped_rank_frame, migration 0022) and are
 * fully independent of the avatar frames bought in the shop
 * (profiles.equipped_frame, src/lib/frameImages.ts), which are unchanged.
 */
export const COSMETIC_FRAMES: CosmeticFrame[] = [
  { id: "none", label: "Kein Rahmen", minLevel: 1, className: "" },
  { id: "eisen", label: "Eisen-Rahmen", minLevel: 5, className: "border-2 border-slate-500/70 shadow-[0_0_10px_rgba(100,116,139,0.35)]" },
  { id: "bronze", label: "Bronze-Rahmen", minLevel: 10, className: "border-2 border-amber-700/80 shadow-[0_0_10px_rgba(180,83,9,0.35)]" },
  { id: "silber", label: "Silber-Rahmen", minLevel: 15, className: "border-2 border-slate-300/80 shadow-[0_0_10px_rgba(203,213,225,0.4)]" },
  { id: "gold", label: "Gold-Rahmen", minLevel: 20, className: "border-2 border-amber-400/90 shadow-[0_0_12px_rgba(251,191,36,0.4)]" },
  { id: "platin", label: "Platin-Rahmen", minLevel: 30, className: "border-2 border-cyan-200/80 shadow-[0_0_12px_rgba(165,243,252,0.4)]" },
  { id: "diamant", label: "Diamant-Rahmen", minLevel: 40, className: "border-2 border-sky-300/90 shadow-[0_0_14px_rgba(125,211,252,0.45)]" },
  { id: "legendaer", label: "Legendärer Rahmen", minLevel: 60, className: "border-2 border-amber-400 op-s-tier-glow" },
];

export function framesUnlockedAtLevel(level: number): CosmeticFrame[] {
  return COSMETIC_FRAMES.filter((f) => f.minLevel <= level);
}
