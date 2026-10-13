import type { Character, Role } from "./characters";

export type DraftAchievement = {
  id: string;
  label: string;
  description: string;
  check: (
    roster: Character[],
    opponentRoster: Character[],
    won: boolean,
    rerolls: number,
    roleAssignments: Record<string, Role> | undefined
  ) => boolean;
};

const TIER_RANK: Record<Character["tier"], number> = { S: 4, A: 3, B: 2, C: 1, D: 0 };
const avgTierRank = (roster: Character[]) =>
  roster.length === 0 ? 0 : roster.reduce((sum, c) => sum + TIER_RANK[c.tier], 0) / roster.length;

export const DRAFT_ACHIEVEMENTS: DraftAchievement[] = [
  {
    id: "draft_no_rerolls",
    label: "Erster Griff",
    description: "Ein komplettes Team ohne einen einzigen Reroll gedraftet und das Duell gewonnen.",
    check: (roster, _opponentRoster, won, rerolls) => roster.length > 0 && rerolls === 0 && won,
  },
  {
    id: "draft_full_s_tier",
    label: "Nur die Besten",
    description: "Ein komplettes Team nur aus S-Tier-Charakteren gedraftet.",
    check: (roster) => roster.length > 0 && roster.every((c) => c.tier === "S"),
  },
  {
    id: "draft_underdog",
    label: "Außenseiter-Draft",
    description: "Mit einem im Schnitt schwächer eingestuften Team gegen ein stärkeres gewonnen.",
    check: (roster, opponentRoster, won) =>
      roster.length > 0 && opponentRoster.length > 0 && won && avgTierRank(roster) < avgTierRank(opponentRoster),
  },
  {
    id: "draft_role_master",
    label: "Perfekte Besetzung",
    description: "Jedem gedrafteten Charakter die eigene natürliche Rolle zugeteilt und gewonnen.",
    check: (roster, _opponentRoster, won, _rerolls, roleAssignments) =>
      roster.length > 0 && won && roster.every((c) => roleAssignments?.[c.id] === c.role),
  },
];

/** Returns every achievement a finished draft match satisfies, for one player's roster/result. */
export function checkDraftAchievements(
  roster: Character[],
  opponentRoster: Character[],
  won: boolean,
  rerolls: number,
  roleAssignments: Record<string, Role> | undefined
): DraftAchievement[] {
  return DRAFT_ACHIEVEMENTS.filter((a) => a.check(roster, opponentRoster, won, rerolls, roleAssignments));
}
