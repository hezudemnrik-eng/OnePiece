import type { Character } from "./characters";
import type { BattleResult } from "./battle-sim";

export type DuelAchievement = {
  id: string;
  label: string;
  description: string;
  check: (winner: Character, loser: Character, battle: BattleResult) => boolean;
};

const TIER_RANK: Record<Character["tier"], number> = { S: 4, A: 3, B: 2, C: 1, D: 0 };

export const DUEL_ACHIEVEMENTS: DuelAchievement[] = [
  {
    id: "duel_underdog",
    label: "Außenseitersieg",
    description: "Ein Charakter mit niedrigerer Tier-Stufe besiegt einen aus einer höheren Stufe.",
    check: (winner, loser) => TIER_RANK[winner.tier] < TIER_RANK[loser.tier],
  },
  {
    id: "duel_flawless",
    label: "Fehlerfrei",
    description: "Gewonnen, ohne auch nur einen Treffer zu kassieren.",
    check: (winner, _loser, battle) => !battle.rounds.some((r) => r.defenderName === winner.name),
  },
  {
    id: "duel_quick_win",
    label: "Blitzsieg",
    description: "Das Duell war nach höchstens 5 Runden entschieden.",
    check: (_winner, _loser, battle) => battle.rounds.length > 0 && battle.rounds.length <= 5,
  },
  {
    id: "duel_marathon",
    label: "Zermürbungskrieg",
    description: "Ein Duell über mindestens 50 Runden durchgestanden.",
    check: (_winner, _loser, battle) => battle.rounds.length >= 50,
  },
];

/** Returns every achievement a finished duel satisfies. */
export function checkDuelAchievements(winner: Character, loser: Character, battle: BattleResult): DuelAchievement[] {
  return DUEL_ACHIEVEMENTS.filter((a) => a.check(winner, loser, battle));
}
