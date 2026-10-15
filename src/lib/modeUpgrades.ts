// Client-side mirror of the per-mode shop upgrades added in migration
// 0021 (Boss: "Updates für jedes Spiel im Shop ... die immer weniger
// bringen"). The actual level/cost/bonus math runs server-side
// (mode_upgrade_cost()/mode_upgrade_bonus_percent() in that migration) —
// these mirrors are for display only, so keep them in sync by hand.

export type GameMode = "imu" | "zufallsgegner" | "live-draft" | "quiz" | "crew" | "blind-ranking" | "fusion" | "duell";

// "xp-berry": raises XP & Berry earned in that mode (server-side, award_xp()).
// "fusion-tier" (fusion only, migration 0023 — Boss, 2026-10-14: it should
// NOT touch XP/Berry): raises the odds of rolling S/A-tier characters
// instead, applied client-side in rollFusionOption() (src/lib/fusionTraits.ts).
export type ModeUpgradeEffect = "xp-berry" | "fusion-tier";

// No "live-draft" entry here (migration 0025 — Boss, 2026-10-15: Shop-Boosts
// gelten überall außer im Live-Draft). The upgrade can't be bought here, and
// award_xp() forces its multiplier to 1 server-side for anyone who already
// owned a level before this change.
export const MODE_UPGRADE_CATALOG: { mode: GameMode; label: string; effect: ModeUpgradeEffect }[] = [
  { mode: "imu", label: "Imu-Duell", effect: "xp-berry" },
  { mode: "zufallsgegner", label: "Zufallsgegner", effect: "xp-berry" },
  { mode: "quiz", label: "Quiz", effect: "xp-berry" },
  { mode: "crew", label: "Crew-Builder", effect: "xp-berry" },
  { mode: "blind-ranking", label: "Blind Ranking", effect: "xp-berry" },
  { mode: "fusion", label: "Fusions-Piraten", effect: "fusion-tier" },
  { mode: "duell", label: "Duell-Board", effect: "xp-berry" },
];

export const MODE_UPGRADE_MAX_LEVEL = 5;

/** Mirrors mode_upgrade_cost(current_level) — cost to go from `currentLevel` to `currentLevel + 1`. */
export function modeUpgradeCost(currentLevel: number): number {
  return 250 * (currentLevel + 1);
}

/** Mirrors mode_upgrade_bonus_percent(level) — cumulative, diminishing-returns XP/Berry bonus for owning `level` upgrades. */
export function modeUpgradeBonusPercent(level: number): number {
  if (level <= 0) return 0;
  return (12 * (1 - Math.pow(0.65, level))) / (1 - 0.65);
}
