import { characters, getDefaultVersion, type Character, type CharacterVersion, type Stats } from "./characters";

export type Difficulty = "leicht" | "mittel" | "schwer";

const DIFFICULTY_STAT_MULTIPLIER: Record<Difficulty, number> = {
  leicht: 0.85,
  mittel: 1.0,
  schwer: 1.25,
};

function statSum(stats: Stats): number {
  return stats.staerke + stats.haki + stats.intelligenz + stats.geschwindigkeit + stats.durabilitaet;
}

function scaleStats(stats: Stats, multiplier: number, bonus: number): Stats {
  const clamp = (n: number) => Math.max(1, Math.min(100, Math.round(n * multiplier + bonus)));
  return {
    staerke: clamp(stats.staerke),
    haki: clamp(stats.haki),
    intelligenz: clamp(stats.intelligenz),
    geschwindigkeit: clamp(stats.geschwindigkeit),
    durabilitaet: clamp(stats.durabilitaet),
  };
}

function pickRandom<T>(pool: T[], n: number, rng: () => number): T[] {
  const copy = [...pool];
  const picked: T[] = [];
  while (picked.length < n && copy.length > 0) {
    const i = Math.floor(rng() * copy.length);
    picked.push(copy.splice(i, 1)[0]);
  }
  return picked;
}

export type AiTeam = {
  characters: Character[];
  versions: CharacterVersion[];
  names: string[];
};

type GenerateAiTeamOptions = {
  teamSize: number;
  difficulty: Difficulty;
  /** Share of the team drawn from the strongest characters rather than randomly. */
  topShare?: number;
  /** Extra flat stat bonus on top of the difficulty multiplier (used for Imu's "Regelvorteile"). */
  flatBonus?: number;
  rng?: () => number;
};

/**
 * Builds an AI opponent team: a mix of the strongest available characters
 * (by total stats) and a random fill from the same pool, each boosted by a
 * difficulty-dependent multiplier. A new random mix is produced on every
 * call, so repeated runs don't face an identical team.
 */
export function generateAiTeam({
  teamSize,
  difficulty,
  topShare = 0.5,
  flatBonus = 0,
  rng = Math.random,
}: GenerateAiTeamOptions): AiTeam {
  const byPower = [...characters].sort(
    (a, b) => statSum(getDefaultVersion(b).stats) - statSum(getDefaultVersion(a).stats)
  );

  const topCount = Math.min(byPower.length, Math.ceil(teamSize * topShare));
  const topPool = byPower.slice(0, Math.max(topCount, teamSize));
  const fixed = pickRandom(topPool, Math.min(topCount, teamSize), rng);

  const remaining = teamSize - fixed.length;
  const randomPool = byPower.filter((c) => !fixed.includes(c));
  const randomPicks = pickRandom(randomPool, remaining, rng);

  const team = [...fixed, ...randomPicks];
  const multiplier = DIFFICULTY_STAT_MULTIPLIER[difficulty];

  const versions: CharacterVersion[] = team.map((c) => {
    const base = getDefaultVersion(c);
    return {
      id: `ai-${base.id}`,
      label: `KI (${difficulty})`,
      stats: scaleStats(base.stats, multiplier, flatBonus),
    };
  });

  return { characters: team, versions, names: team.map((c) => c.name) };
}
