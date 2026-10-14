// Client-side mirror of the per-mode shop upgrades added in migration
// 0021 (Boss: "Updates für jedes Spiel im Shop ... die immer weniger
// bringen"). The actual level/cost/bonus math runs server-side
// (mode_upgrade_cost()/mode_upgrade_bonus_percent() in that migration) —
// these mirrors are for display only, so keep them in sync by hand.

export type GameMode = "imu" | "zufallsgegner" | "live-draft" | "quiz" | "crew" | "blind-ranking" | "fusion" | "duell";

export const MODE_UPGRADE_CATALOG: { mode: GameMode; label: string }[] = [
  { mode: "imu", label: "Imu-Duell" },
  { mode: "zufallsgegner", label: "Zufallsgegner" },
  { mode: "live-draft", label: "Live-Draft" },
  { mode: "quiz", label: "Quiz" },
  { mode: "crew", label: "Crew-Builder" },
  { mode: "blind-ranking", label: "Blind Ranking" },
  { mode: "fusion", label: "Fusions-Piraten" },
  { mode: "duell", label: "Duell-Board" },
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
