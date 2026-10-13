export type TierListAchievement = {
  id: string;
  label: string;
  description: string;
  check: (categoryId: string, assignedCount: number, totalItems: number) => boolean;
};

export const TIER_LIST_ACHIEVEMENTS: TierListAchievement[] = [
  {
    id: "tierlist_complete",
    label: "Vollständig einsortiert",
    description: "Eine Kategorie mit mindestens 10 Einträgen komplett in Tiers eingeordnet.",
    check: (_categoryId, assignedCount, totalItems) => totalItems >= 10 && assignedCount >= totalItems,
  },
  {
    id: "tierlist_elite",
    label: "Elite-Analyst",
    description: "Die Elite-Liga (nur S-Tier-Charaktere) komplett eingestuft.",
    check: (categoryId, assignedCount, totalItems) => categoryId === "s_tier" && totalItems > 0 && assignedCount >= totalItems,
  },
  {
    id: "tierlist_custom_complete",
    label: "Eigene Ordnung",
    description: "Eine selbst erstellte Kategorie komplett eingestuft.",
    check: (categoryId, assignedCount, totalItems) =>
      categoryId.startsWith("custom:") && totalItems > 0 && assignedCount >= totalItems,
  },
];

/** Returns every achievement a tier-list save satisfies. */
export function checkTierListAchievements(
  categoryId: string,
  assignedCount: number,
  totalItems: number
): TierListAchievement[] {
  return TIER_LIST_ACHIEVEMENTS.filter((a) => a.check(categoryId, assignedCount, totalItems));
}
