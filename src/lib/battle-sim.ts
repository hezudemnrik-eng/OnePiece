import type { CharacterVersion } from "./characters";

export type BattleFighter = {
  characterId: string;
  name: string;
  version: CharacterVersion;
  hp: number;
  attacksPerRound: number;
};

export type BattleRound = {
  round: number;
  attackerName: string;
  defenderName: string;
  damage: number;
  critical: boolean;
  defenderHpAfter: number;
};

export type BattleResult = {
  winnerTeam: "A" | "B";
  /** Set only by simulateFreeForAll (3+ players, no teams) — indexes into the
   * draft's players array in turn order. winnerTeam is left as a dummy "A"
   * in that case since there's no two-sided team to label. */
  winnerIndex?: number;
  rounds: BattleRound[];
};

const MAX_HP_PER_FIGHTER = 150;
const MAX_ROUNDS = 100;

function toFighters(versions: CharacterVersion[], names: string[]): BattleFighter[] {
  return versions.map((version, i) => ({
    characterId: version.id,
    name: names[i],
    version,
    hp: MAX_HP_PER_FIGHTER + version.stats.durabilitaet,
    attacksPerRound: Math.max(1, version.attacksPerRound ?? 1),
  }));
}

function teamPower(fighter: BattleFighter): number {
  const { staerke, haki, geschwindigkeit } = fighter.version.stats;
  return staerke * 0.5 + haki * 0.35 + geschwindigkeit * 0.15;
}

function rollDamage(attacker: BattleFighter, rng: () => number): { damage: number; critical: boolean } {
  const base = teamPower(attacker) * 0.4;
  const variance = 0.7 + rng() * 0.6; // 0.7x - 1.3x
  const critical = rng() < 0.12 + attacker.version.stats.haki / 1000;
  const damage = Math.max(1, Math.round(base * variance * (critical ? 1.8 : 1)));
  return { damage, critical };
}

/**
 * Round-based battle simulation between two drafted teams.
 * Each round, every living fighter on team A attacks a random living
 * fighter on team B and vice versa; last team with survivors wins.
 * A seedable rng keeps results reproducible for tests, while the real
 * app passes Math.random for a genuinely random outcome per the
 * "Zufallselement" requirement from the question catalog.
 */
export function simulateBattle(
  teamAVersions: CharacterVersion[],
  teamANames: string[],
  teamBVersions: CharacterVersion[],
  teamBNames: string[],
  rng: () => number = Math.random
): BattleResult {
  const teamA = toFighters(teamAVersions, teamANames);
  const teamB = toFighters(teamBVersions, teamBNames);
  const rounds: BattleRound[] = [];

  let roundNumber = 0;
  while (roundNumber < MAX_ROUNDS) {
    roundNumber++;
    const aliveA = teamA.filter((f) => f.hp > 0);
    const aliveB = teamB.filter((f) => f.hp > 0);
    if (aliveA.length === 0 || aliveB.length === 0) break;

    for (const attacker of aliveA) {
      for (let hit = 0; hit < attacker.attacksPerRound; hit++) {
        const targets = teamB.filter((f) => f.hp > 0);
        if (targets.length === 0) break;
        const defender = targets[Math.floor(rng() * targets.length)];
        const { damage, critical } = rollDamage(attacker, rng);
        defender.hp = Math.max(0, defender.hp - damage);
        rounds.push({
          round: roundNumber,
          attackerName: attacker.name,
          defenderName: defender.name,
          damage,
          critical,
          defenderHpAfter: defender.hp,
        });
      }
    }

    for (const attacker of teamB.filter((f) => f.hp > 0)) {
      for (let hit = 0; hit < attacker.attacksPerRound; hit++) {
        const targets = teamA.filter((f) => f.hp > 0);
        if (targets.length === 0) break;
        const defender = targets[Math.floor(rng() * targets.length)];
        const { damage, critical } = rollDamage(attacker, rng);
        defender.hp = Math.max(0, defender.hp - damage);
        rounds.push({
          round: roundNumber,
          attackerName: attacker.name,
          defenderName: defender.name,
          damage,
          critical,
          defenderHpAfter: defender.hp,
        });
      }
    }
  }

  const aAlive = teamA.some((f) => f.hp > 0);
  const winnerTeam: "A" | "B" = aAlive ? "A" : "B";
  return { winnerTeam, rounds };
}

/**
 * Round-based battle simulation between 3+ players with no teams (free-for-
 * all Live-Draft, Boss: "ich will den modus auch zu dritt spielen können").
 * Each round, every living fighter attacks a random living fighter chosen
 * from across ALL other sides combined (not "the next side" or any fixed
 * order) — same even-chances targeting as the two-side version, just pooled
 * over more opponents. Last side with survivors wins.
 */
export function simulateFreeForAll(
  sidesVersions: CharacterVersion[][],
  sidesNames: string[][],
  rng: () => number = Math.random
): { winnerIndex: number; rounds: BattleRound[] } {
  const sides = sidesVersions.map((versions, i) => toFighters(versions, sidesNames[i]));
  const rounds: BattleRound[] = [];

  let roundNumber = 0;
  while (roundNumber < MAX_ROUNDS) {
    roundNumber++;
    const sidesAlive = sides.filter((side) => side.some((f) => f.hp > 0));
    if (sidesAlive.length <= 1) break;

    for (let i = 0; i < sides.length; i++) {
      const attackers = sides[i].filter((f) => f.hp > 0);
      for (const attacker of attackers) {
        for (let hit = 0; hit < attacker.attacksPerRound; hit++) {
          const targets = sides.flatMap((side, j) => (j === i ? [] : side.filter((f) => f.hp > 0)));
          if (targets.length === 0) break;
          const defender = targets[Math.floor(rng() * targets.length)];
          const { damage, critical } = rollDamage(attacker, rng);
          defender.hp = Math.max(0, defender.hp - damage);
          rounds.push({
            round: roundNumber,
            attackerName: attacker.name,
            defenderName: defender.name,
            damage,
            critical,
            defenderHpAfter: defender.hp,
          });
        }
      }
    }
  }

  const winnerIndex = sides.findIndex((side) => side.some((f) => f.hp > 0));
  return { winnerIndex: winnerIndex === -1 ? 0 : winnerIndex, rounds };
}
