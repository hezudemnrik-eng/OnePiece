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
  {
    id: "crew_high_synergy",
    label: "Perfekt eingespielt",
    description: "Eine Crew mit mindestens 300 Synergie-Bonus zusammengestellt.",
    check: (_picks, summary) => summary.synergyBonus >= 300,
  },
  {
    id: "crew_power_cap",
    label: "Übermächtige Crew",
    description: "Eine Crew mit mindestens 4000 Gesamtstärke zusammengestellt.",
    check: (_picks, summary) => summary.totalPower >= 4000,
  },
  {
    id: "crew_alliance",
    label: "Bündnis der Verbannten",
    description: "Jede Rolle mit einem Mitglied aus einer anderen Crew besetzt.",
    check: (picks) => picks.length > 1 && new Set(picks.map((p) => p.character.crew)).size === picks.length,
  },
];

/** Returns every achievement a finished crew satisfies. */
export function checkCrewAchievements(picks: CrewPick[], summary: CrewSummary, rerolls: number): CrewAchievement[] {
  return CREW_ACHIEVEMENTS.filter((a) => a.check(picks, summary, rerolls));
}
