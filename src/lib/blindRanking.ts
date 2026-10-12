import { characters, getStrongestVersion, type Character } from "./characters";

export type BlindEntry = {
  /** Stable id for this round, independent of the character id (a character could in theory appear once per round). */
  slotId: string;
  characterId: string;
  name: string;
  imageUrl?: string | null;
  /** Ground truth value this theme ranks by — higher means "stronger"/first place. */
  value: number;
  /** Human-readable version of `value`, revealed after guessing (e.g. "95 Haki"). */
  valueLabel: string;
};

export type BlindTheme = {
  id: string;
  label: string;
  description: string;
};

function statSum(c: Character): number {
  const s = getStrongestVersion(c).stats;
  return s.staerke + s.haki + s.intelligenz + s.geschwindigkeit + s.durabilitaet;
}

// Canon-confirmed Conqueror's-Haki ("Königshaki") users only — kept short and
// conservative on purpose. Many fan-favorite guesses (Kid, Law, Garp, Sabo, ...)
// are never explicitly confirmed on-screen, so they're left out rather than
// risking a wrong "ground truth" for the ranking.
const KINGS_HAKI_USER_IDS = [
  "luffy",
  "shanks",
  "whitebeard",
  "kaido",
  "big-mom",
  "katakuri",
  "rayleigh",
  "doflamingo",
  "boa-hancock",
  "zoro",
  "buggy",
  "roger",
];

type ThemeDef = BlindTheme & {
  pool: () => Character[];
  value: (c: Character) => number;
  valueLabel: (c: Character) => string;
};

const THEME_DEFS: ThemeDef[] = [
  {
    id: "koenigshaki",
    label: "Blind Ranking: Königshaki-Nutzer",
    description: "Ordne die bestätigten Nutzer von Königshaki (Conqueror's Haki) nach Stärke ihres Hakis.",
    pool: () => characters.filter((c) => KINGS_HAKI_USER_IDS.includes(c.id)),
    value: (c) => getStrongestVersion(c).stats.haki,
    valueLabel: (c) => `${getStrongestVersion(c).stats.haki} Haki`,
  },
  {
    id: "staerke",
    label: "Blind Ranking: Stärkste Charaktere",
    description: "Ordne die Charaktere nach reiner körperlicher Stärke.",
    pool: () => characters,
    value: (c) => getStrongestVersion(c).stats.staerke,
    valueLabel: (c) => `${getStrongestVersion(c).stats.staerke} Stärke`,
  },
  {
    id: "geschwindigkeit",
    label: "Blind Ranking: Schnellste Charaktere",
    description: "Ordne die Charaktere nach Geschwindigkeit.",
    pool: () => characters,
    value: (c) => getStrongestVersion(c).stats.geschwindigkeit,
    valueLabel: (c) => `${getStrongestVersion(c).stats.geschwindigkeit} Geschwindigkeit`,
  },
  {
    id: "haki",
    label: "Blind Ranking: Beste Haki-Nutzer",
    description: "Ordne die Charaktere nach Haki-Stärke.",
    pool: () => characters,
    value: (c) => getStrongestVersion(c).stats.haki,
    valueLabel: (c) => `${getStrongestVersion(c).stats.haki} Haki`,
  },
  {
    id: "intelligenz",
    label: "Blind Ranking: Klügste Charaktere",
    description: "Ordne die Charaktere nach Intelligenz.",
    pool: () => characters,
    value: (c) => getStrongestVersion(c).stats.intelligenz,
    valueLabel: (c) => `${getStrongestVersion(c).stats.intelligenz} Intelligenz`,
  },
  {
    id: "durabilitaet",
    label: "Blind Ranking: Widerstandsfähigste Charaktere",
    description: "Ordne die Charaktere nach Durabilität (Widerstandskraft).",
    pool: () => characters,
    value: (c) => getStrongestVersion(c).stats.durabilitaet,
    valueLabel: (c) => `${getStrongestVersion(c).stats.durabilitaet} Durabilität`,
  },
  {
    id: "gesamtkampfkraft",
    label: "Blind Ranking: Gesamtkampfkraft",
    description: "Ordne die Charaktere nach der Summe aller Kampfwerte.",
    pool: () => characters,
    value: (c) => statSum(c),
    valueLabel: (c) => `${statSum(c)} Gesamtkampfkraft`,
  },
];

export const BLIND_THEMES: BlindTheme[] = THEME_DEFS.map(({ id, label, description }) => ({ id, label, description }));

function pickRandom<T>(pool: T[], n: number, rng: () => number): T[] {
  const copy = [...pool];
  const picked: T[] = [];
  while (picked.length < n && copy.length > 0) {
    const i = Math.floor(rng() * copy.length);
    picked.push(copy.splice(i, 1)[0]);
  }
  return picked;
}

/** Builds one round: `size` random entries from the theme's pool, in random (hidden) order. */
export function buildRound(themeId: string, size = 6, rng: () => number = Math.random): BlindEntry[] {
  const def = THEME_DEFS.find((t) => t.id === themeId) ?? THEME_DEFS[0];
  const pool = def.pool();
  const picked = pickRandom(pool, Math.min(size, pool.length), rng);
  return picked.map((c) => ({
    slotId: `${def.id}-${c.id}`,
    characterId: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    value: def.value(c),
    valueLabel: def.valueLabel(c),
  }));
}

/** Correct order for a round, strongest/highest value first. */
export function correctOrder(round: BlindEntry[]): BlindEntry[] {
  return [...round].sort((a, b) => b.value - a.value);
}

export type BlindScore = {
  correctPositions: number;
  total: number;
  /** Sum of |guessed position - correct position| — lower is better, 0 is a perfect run. */
  positionError: number;
};

/** Scores a guessed order (array of slotIds, position 0 = "stärkster") against the true order. */
export function scoreGuess(round: BlindEntry[], guessedSlotIds: string[]): BlindScore {
  const truth = correctOrder(round);
  const truthIndex = new Map(truth.map((e, i) => [e.slotId, i]));
  let correctPositions = 0;
  let positionError = 0;
  guessedSlotIds.forEach((slotId, i) => {
    const trueIndex = truthIndex.get(slotId) ?? i;
    if (trueIndex === i) correctPositions++;
    positionError += Math.abs(trueIndex - i);
  });
  return { correctPositions, total: guessedSlotIds.length, positionError };
}
