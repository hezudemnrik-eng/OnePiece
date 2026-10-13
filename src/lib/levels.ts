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
  return 20 * level * (level - 1);
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

// Flat/scaled XP awards per completed action across the app.
export const XP_MATCH_WIN = 25;
export const XP_MATCH_LOSS = 10;
export const XP_QUIZ_BASE = 5;
export const XP_QUIZ_PER_CORRECT = 1;
export const XP_CREW_COMPLETE = 12;
export const XP_BLIND_RANKING_COMPLETE = 12;
export const XP_FUSION_BASE = 10;
export const XP_ACHIEVEMENT_BONUS = 15;

/** Fusions-Pirat XP scales with the bounty: +1 XP per 100M Berry, capped. */
export function fusionXpForBounty(bounty: number): number {
  return XP_FUSION_BASE + Math.min(50, Math.floor(bounty / 100_000_000));
}

export type CosmeticFrame = {
  id: string;
  label: string;
  minLevel: number;
  /** Tailwind border classes applied around an avatar. */
  className: string;
};

export const COSMETIC_FRAMES: CosmeticFrame[] = [
  { id: "none", label: "Kein Rahmen", minLevel: 1, className: "" },
  { id: "bronze", label: "Bronze-Rahmen", minLevel: 5, className: "ring-2 ring-amber-700" },
  { id: "silver", label: "Silber-Rahmen", minLevel: 15, className: "ring-2 ring-slate-400" },
  { id: "gold", label: "Gold-Rahmen", minLevel: 30, className: "ring-2 ring-amber-400" },
  { id: "legendary", label: "Legendärer Rahmen", minLevel: 60, className: "ring-2 ring-amber-400 ring-offset-2 ring-offset-[var(--background)] op-s-tier-glow" },
];

export function framesUnlockedAtLevel(level: number): CosmeticFrame[] {
  return COSMETIC_FRAMES.filter((f) => f.minLevel <= level);
}
