import { getDefaultVersion, ROLES, type Character, type CharacterVersion, type Role, type Stats } from "./characters";

export const ASSIGNABLE_ROLES: readonly Role[] = ROLES;

const ROLE_MATCH_MULTIPLIER = 1.15;
const ROLE_MISMATCH_MULTIPLIER = 0.85;

export type RoleFit = "match" | "neutral" | "mismatch";

/**
 * How well an assigned crew position fits a character's own (canonical)
 * role — Chopper is a great Arzt but a bad Kapitän, per the feature
 * request. "Sonstige" is always neutral: the safe slot for a character
 * who doesn't fit anywhere specific, with no bonus or penalty either way.
 */
export function roleFit(characterRole: Role, assignedRole: Role): RoleFit {
  if (assignedRole === "Sonstige") return "neutral";
  if (assignedRole === characterRole) return "match";
  return "mismatch";
}

/** Applies the crew-position bonus/malus to a character's stats before battle. */
export function applyRoleFit(stats: Stats, characterRole: Role, assignedRole: Role): Stats {
  const fit = roleFit(characterRole, assignedRole);
  const multiplier = fit === "match" ? ROLE_MATCH_MULTIPLIER : fit === "mismatch" ? ROLE_MISMATCH_MULTIPLIER : 1;
  if (multiplier === 1) return stats;
  const scale = (n: number) => Math.max(1, Math.round(n * multiplier));
  return {
    staerke: scale(stats.staerke),
    haki: scale(stats.haki),
    intelligenz: scale(stats.intelligenz),
    geschwindigkeit: scale(stats.geschwindigkeit),
    durabilitaet: scale(stats.durabilitaet),
  };
}

/** Builds battle-ready versions for a roster, applying each character's assigned-role bonus/malus (if any). Characters with no assignment fight with unmodified stats. */
export function getRoleAdjustedVersions(
  roster: Character[],
  assignments: Record<string, Role> | undefined
): CharacterVersion[] {
  return roster.map((c) => {
    const base = getDefaultVersion(c);
    const assignedRole = assignments?.[c.id];
    if (!assignedRole) return base;
    return { ...base, stats: applyRoleFit(base.stats, c.role, assignedRole) };
  });
}
