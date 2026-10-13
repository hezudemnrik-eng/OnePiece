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
  {
    id: "quiz_foundation",
    label: "Fundament gelegt",
    description: "Mindestens 10 Fragen auf Schwierigkeit 'leicht' komplett richtig.",
    check: (score, total, difficulty) => difficulty === "leicht" && total >= 10 && score === total,
  },
  {
    id: "quiz_allrounder",
    label: "Allrounder",
    description: "Mindestens 90% richtig bei 20 oder mehr gemischten Fragen.",
    check: (score, total, difficulty) => difficulty === "alle" && total >= 20 && score / total >= 0.9,
  },
  {
    id: "quiz_century",
    label: "Jahrhundert-Quiz",
    description: "Ein Quiz mit 100 oder mehr Fragen abgeschlossen.",
    check: (_score, total) => total >= 100,
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
