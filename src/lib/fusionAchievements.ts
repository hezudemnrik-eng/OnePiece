import { getCharacterById } from "./characters";
import type { FusionOption } from "./fusionTraits";

export type FusionAchievement = {
  id: string;
  label: string;
  description: string;
  check: (picks: FusionOption[], bounty: number) => boolean;
};

// The four house-rule/lore one-character races from the Race pool (see
// RACES in fusionTraits.ts) — each has exactly 1 holder out of 300.
const RARE_RACES = new Set(["Lunarianer", "Elefant", "Seestern", "Bukanier"]);

export const FUSION_ACHIEVEMENTS: FusionAchievement[] = [
  {
    id: "fusion_rare_race",
    label: "Seltene Rasse getroffen",
    description: "Mindestens eine nicht-menschliche Rasse unter deinen Picks.",
    check: (picks) => {
      const race = picks.find((p) => p.categoryId === "race");
      return Boolean(race) && race!.traitLabel !== "Mensch";
    },
  },
  {
    id: "fusion_legendary_race",
    label: "Legendär selten",
    description: "Eine der vier einzigartigen Rassen getroffen (Lunarianer, Elefant, Seestern oder Bukanier).",
    check: (picks) => {
      const race = picks.find((p) => p.categoryId === "race");
      return Boolean(race) && RARE_RACES.has(race!.traitLabel);
    },
  },
  {
    id: "fusion_strawhat_set",
    label: "Vollblut-Strohhut",
    description: "Alle 7 Picks stammen von Mitgliedern der Strohhutbande.",
    check: (picks) =>
      picks.length === 7 && picks.every((p) => getCharacterById(p.sourceCharacterId)?.crew === "Strohhutbande"),
  },
  {
    id: "fusion_s_tier_set",
    label: "Nur S-Tier",
    description: "Alle 7 Picks stammen von S-Tier-Charakteren.",
    check: (picks) => picks.length === 7 && picks.every((p) => getCharacterById(p.sourceCharacterId)?.tier === "S"),
  },
  {
    id: "fusion_bounty_1b",
    label: "Über 1 Milliarde",
    description: "Ein Fusions-Pirat mit mindestens 1.000.000.000 Berry Kopfgeld.",
    check: (_picks, bounty) => bounty >= 1_000_000_000,
  },
  {
    id: "fusion_bounty_max",
    label: "Maximal-Kopfgeld",
    description: "Praktisch das höchstmögliche Kopfgeld erreicht.",
    // The real achievable ceiling is exactly 6_000_000_000 (see computeBounty
    // in fusionTraits.ts). The old threshold (4_900_000_000) sat above the
    // old real max (4_579_000_000), so this achievement could never fire.
    check: (_picks, bounty) => bounty >= 5_900_000_000,
  },
  {
    id: "fusion_haki_master",
    label: "Außergewöhnliches Haki",
    description: "Den bestmöglichen Haki-Pick getroffen.",
    check: (picks) => (picks.find((p) => p.categoryId === "haki")?.score ?? 0) >= 90,
  },
  {
    id: "fusion_genius_mind",
    label: "Strategisches Genie",
    description: "Den bestmöglichen Mind-Pick getroffen.",
    check: (picks) => (picks.find((p) => p.categoryId === "mind")?.score ?? 0) >= 90,
  },
];

/** Returns every achievement a finished fusion satisfies. */
export function checkFusionAchievements(picks: FusionOption[], bounty: number): FusionAchievement[] {
  return FUSION_ACHIEVEMENTS.filter((a) => a.check(picks, bounty));
}
