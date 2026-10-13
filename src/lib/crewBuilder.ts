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

export type SynergyGroup = { crew: string; count: number; bonus: number };

export type CrewSummary = {
  totalPower: number;
  basePower: number;
  synergyBonus: number;
  synergyGroups: SynergyGroup[];
  grade: Tier;
};

// Flat bonus per crewmate beyond the first sharing the same origin crew
// (Q132) — linear in group size rather than per-pair, so a full same-crew
// roster gives a meaningful but not run-away bonus (e.g. 10 Strawhats:
// +9*60 = +540, roughly one grade tier's worth).
const SYNERGY_BONUS_PER_EXTRA_MEMBER = 60;

function computeSynergy(picks: CrewPick[]): { bonus: number; groups: SynergyGroup[] } {
  const counts = new Map<string, number>();
  for (const { character } of picks) counts.set(character.crew, (counts.get(character.crew) ?? 0) + 1);
  const groups = Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([crew, count]) => ({ crew, count, bonus: (count - 1) * SYNERGY_BONUS_PER_EXTRA_MEMBER }));
  const bonus = groups.reduce((sum, g) => sum + g.bonus, 0);
  return { bonus, groups };
}

/** Total crew power (role-fit-adjusted stat sum plus same-crew synergy bonus) and a letter grade for it. */
export function summarizeCrew(picks: CrewPick[]): CrewSummary {
  const basePower = picks.reduce((sum, { role, character }) => {
    const stats = applyRoleFit(getStrongestVersion(character).stats, character.role, role);
    return sum + stats.staerke + stats.haki + stats.intelligenz + stats.geschwindigkeit + stats.durabilitaet;
  }, 0);
  const { bonus: synergyBonus, groups: synergyGroups } = computeSynergy(picks);
  const totalPower = basePower + synergyBonus;
  const grade = GRADE_THRESHOLDS.find((t) => totalPower >= t.min)?.grade ?? "D";
  return { totalPower, basePower, synergyBonus, synergyGroups, grade };
}

/** Rolls a full random opposing crew (one random character per role) for the Crew-Builder team-duel feature (Q137). */
export function rollOpposingCrew(rng: () => number = Math.random): CrewPick[] {
  const picks: CrewPick[] = [];
  for (const role of CREW_ROLES) {
    const candidate = rollCandidate(picks.map((p) => p.character.id), rng);
    if (candidate) picks.push({ role, character: candidate });
  }
  return picks;
}

export { roleFit };
