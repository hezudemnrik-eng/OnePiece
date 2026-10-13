import type { BlindScore } from "./blindRanking";

export type BlindRankingAchievement = {
  id: string;
  label: string;
  description: string;
  check: (score: BlindScore) => boolean;
};

export const BLIND_RANKING_ACHIEVEMENTS: BlindRankingAchievement[] = [
  {
    id: "blind_perfect",
    label: "Scharfes Auge",
    description: "Eine Runde komplett richtig einsortiert.",
    check: (score) => score.total > 0 && score.correctPositions === score.total,
  },
  {
    id: "blind_near_perfect_big",
    label: "Fast perfekt, groß gedacht",
    description: "Bei einer Runde mit 8 Charakteren höchstens einen Platz verfehlt.",
    check: (score) => score.total >= 8 && score.correctPositions >= score.total - 1,
  },
  {
    id: "blind_low_error",
    label: "Kaum daneben",
    description: "Gesamtabweichung von höchstens 2 Plätzen über die ganze Runde.",
    check: (score) => score.total > 0 && score.positionError <= 2,
  },
];

/** Returns every achievement a finished blind-ranking round satisfies. */
export function checkBlindRankingAchievements(score: BlindScore): BlindRankingAchievement[] {
  return BLIND_RANKING_ACHIEVEMENTS.filter((a) => a.check(score));
}
