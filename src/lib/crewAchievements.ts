import type { CrewPick, CrewSummary } from "./crewBuilder";

export type CrewAchievement = {
  id: string;
  label: string;
  description: string;
  check: (picks: CrewPick[], summary: CrewSummary, rerolls: number) => boolean;
};

export const CREW_ACHIEVEMENTS: CrewAchievement[] = [
  {
    id: "crew_grade_s",
    label: "S-Klasse-Crew",
    description: "Eine Crew mit Gesamtnote S zusammengestellt.",
    check: (_picks, summary) => summary.grade === "S",
  },
  {
    id: "crew_strawhat_set",
    label: "Original-Strohhüte",
    description: "Jede Rolle mit einem Mitglied der Strohhutbande besetzt.",
    check: (picks) => picks.length > 0 && picks.every((p) => p.character.crew === "Strohhutbande"),
  },
  {
    id: "crew_no_rerolls",
    label: "Erster Eindruck zählt",
    description: "Eine komplette Crew ohne einen einzigen Reroll zusammengestellt.",
    check: (picks, _summary, rerolls) => picks.length > 0 && rerolls === 0,
  },
];

/** Returns every achievement a finished crew satisfies. */
export function checkCrewAchievements(picks: CrewPick[], summary: CrewSummary, rerolls: number): CrewAchievement[] {
  return CREW_ACHIEVEMENTS.filter((a) => a.check(picks, summary, rerolls));
}
