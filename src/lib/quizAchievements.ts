import type { QuizDifficulty } from "./quiz";

export type QuizAchievement = {
  id: string;
  label: string;
  description: string;
  check: (score: number, total: number, difficulty: QuizDifficulty | "alle") => boolean;
};

export const QUIZ_ACHIEVEMENTS: QuizAchievement[] = [
  {
    id: "quiz_perfect",
    label: "Perfekte Runde",
    description: "Mindestens 5 Fragen, alle richtig beantwortet.",
    check: (score, total) => total >= 5 && score === total,
  },
  {
    id: "quiz_hard_clear",
    label: "Schwer gemeistert",
    description: "Mindestens 80% richtig auf Schwierigkeit 'schwer'.",
    check: (score, total, difficulty) => difficulty === "schwer" && total > 0 && score / total >= 0.8,
  },
  {
    id: "quiz_marathon",
    label: "Quiz-Marathon",
    description: "Ein Quiz mit 50 oder mehr Fragen abgeschlossen.",
    check: (_score, total) => total >= 50,
  },
];

/** Returns every achievement a finished quiz run satisfies. */
export function checkQuizAchievements(
  score: number,
  total: number,
  difficulty: QuizDifficulty | "alle"
): QuizAchievement[] {
  return QUIZ_ACHIEVEMENTS.filter((a) => a.check(score, total, difficulty));
}
