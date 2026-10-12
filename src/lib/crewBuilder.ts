import { characters, getStrongestVersion, type Character, type Role, type Tier } from "./characters";
import { applyRoleFit, roleFit } from "./crewRoles";

/** Roles offered as crew slots, in a sensible ship-crew order. "Sonstige" is deliberately left out — it's the catch-all non-slot in the tier-list/draft tools, not a crew position to fill here. */
export const CREW_ROLES: Role[] = [
  "Kapitän",
  "Erster Offizier",
  "Kämpfer",
  "Navigator",
  "Koch",
  "Arzt",
  "Scharfschütze",
  "Zimmermann",
  "Musiker",
  "Archäologe",
  "Steuermann",
];

/** Rolls a random character for a crew slot, excluding characters already locked into other slots. */
export function rollCandidate(excludeIds: string[], rng: () => number = Math.random): Character | null {
  const pool = characters.filter((c) => !excludeIds.includes(c.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}

export type CrewPick = { role: Role; character: Character };

const GRADE_THRESHOLDS: Array<{ min: number; grade: Tier }> = [
  { min: 3600, grade: "S" },
  { min: 3000, grade: "A" },
  { min: 2400, grade: "B" },
  { min: 1800, grade: "C" },
  { min: 0, grade: "D" },
];

export type CrewSummary = {
  totalPower: number;
  grade: Tier;
};

/** Total crew power (role-fit-adjusted stat sum across all filled slots) and a letter grade for it. */
export function summarizeCrew(picks: CrewPick[]): CrewSummary {
  const totalPower = picks.reduce((sum, { role, character }) => {
    const stats = applyRoleFit(getStrongestVersion(character).stats, character.role, role);
    return sum + stats.staerke + stats.haki + stats.intelligenz + stats.geschwindigkeit + stats.durabilitaet;
  }, 0);
  const grade = GRADE_THRESHOLDS.find((t) => totalPower >= t.min)?.grade ?? "D";
  return { totalPower, grade };
}

export { roleFit };
