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

// Imu fights alone as a single boss rather than a generated team (see
// SoloDraftBoard) — "stark" per the feature questionnaire: noticeably
// tougher than any roster character, but not scaled so high the fight
// becomes unwinnable.
//
// Because the battle sim lets every living fighter attack once per round,
// a 5-person team lands 5 hits on Imu per round while he, being alone,
// only ever lands 1 hit back (spread randomly, not focused) — stat bumps
// alone can't close that gap (a team of 5 top-roster characters killed
// even a massively stat-boosted, 650-durabilitaet Imu in ~4 rounds in
// simulation, before he could meaningfully punish them back). So besides
// higher stats/HP, he also gets extra attacks per round via
// CharacterVersion.attacksPerRound, closing the action-count gap directly.
//
// Tuned (500-fight Monte Carlo sim each) against teams drawn only from
// B-tier-or-better characters, since SoloDraftBoard restricts the Imu
// draft pool to S/A/B (see bossTierPool) — a random B+ team wins ~87% of
// the time on leicht, ~55% on mittel, ~4% on schwer; the best possible
// 5-character team still beats schwer about 83% of the time, so it stays
// winnable with a good draft even at max difficulty.
const IMU_BASE_STATS: Stats = { staerke: 105, haki: 105, intelligenz: 95, geschwindigkeit: 90, durabilitaet: 100 };
const IMU_DIFFICULTY: Record<Difficulty, { statMultiplier: number; durabilitaet: number; attacksPerRound: number }> = {
  leicht: { statMultiplier: 1.3, durabilitaet: 900, attacksPerRound: 2 },
  mittel: { statMultiplier: 1.05, durabilitaet: 920, attacksPerRound: 3 },
  schwer: { statMultiplier: 1.35, durabilitaet: 950, attacksPerRound: 3 },
};

export function generateImuBoss(difficulty: Difficulty): AiTeam {
  const imuCharacter = characters.find((c) => c.id === "imu");
  if (!imuCharacter) throw new Error("Imu character data missing");
  const cfg = IMU_DIFFICULTY[difficulty];
  const stats: Stats = {
    staerke: Math.round(IMU_BASE_STATS.staerke * cfg.statMultiplier),
    haki: Math.round(IMU_BASE_STATS.haki * cfg.statMultiplier),
    intelligenz: Math.round(IMU_BASE_STATS.intelligenz * cfg.statMultiplier),
    geschwindigkeit: Math.round(IMU_BASE_STATS.geschwindigkeit * cfg.statMultiplier),
    durabilitaet: cfg.durabilitaet,
  };
  const version: CharacterVersion = {
    id: "imu-boss",
    label: `Imu (${difficulty})`,
    stats,
    attacksPerRound: cfg.attacksPerRound,
  };
  return { characters: [imuCharacter], versions: [version], names: ["Imu"] };
}
