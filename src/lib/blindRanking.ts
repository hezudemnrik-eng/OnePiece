import { characters, getStrongestVersion, type Character } from "./characters";
import { classifyFruit } from "./fruitType";

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

// 20 built-in templates (Q155) — the original 7 single-stat rankings, plus
// composite-stat, filtered-pool and draft/devil-fruit-flavored ones for
// variety. Ties within a theme (two characters sharing the same value) are
// fine — buildRound/scoreGuess only ever compare *positions*, never values
// directly, so a tie just resolves to whatever stable order Array.sort gives.
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
  {
    id: "zaehigkeit",
    label: "Blind Ranking: Zäheste Kämpfer",
    description: "Ordne die Charaktere nach einer Mischung aus Stärke und Durabilität.",
    pool: () => characters,
    value: (c) => {
      const s = getStrongestVersion(c).stats;
      return Math.round(s.staerke * 0.5 + s.durabilitaet * 0.5);
    },
    valueLabel: (c) => {
      const s = getStrongestVersion(c).stats;
      return `${Math.round(s.staerke * 0.5 + s.durabilitaet * 0.5)} Zähigkeit`;
    },
  },
  {
    id: "reaktion",
    label: "Blind Ranking: Reaktionsschnellste Kämpfer",
    description: "Ordne die Charaktere nach einer Mischung aus Geschwindigkeit und Haki.",
    pool: () => characters,
    value: (c) => {
      const s = getStrongestVersion(c).stats;
      return Math.round(s.geschwindigkeit * 0.7 + s.haki * 0.3);
    },
    valueLabel: (c) => {
      const s = getStrongestVersion(c).stats;
      return `${Math.round(s.geschwindigkeit * 0.7 + s.haki * 0.3)} Reaktionswert`;
    },
  },
  {
    id: "stratege",
    label: "Blind Ranking: Beste Strategen",
    description: "Ordne die Charaktere nach einer Mischung aus Intelligenz und Haki.",
    pool: () => characters,
    value: (c) => {
      const s = getStrongestVersion(c).stats;
      return Math.round(s.intelligenz * 0.6 + s.haki * 0.4);
    },
    valueLabel: (c) => {
      const s = getStrongestVersion(c).stats;
      return `${Math.round(s.intelligenz * 0.6 + s.haki * 0.4)} Strategie-Wert`;
    },
  },
  {
    id: "tier_einstufung",
    label: "Blind Ranking: Offizielle Tier-Einstufung",
    description: "Ordne die Charaktere nach ihrer S–D-Tier-Einstufung (Gesamtkampfkraft als Tiebreaker).",
    pool: () => characters,
    value: (c) => ({ S: 4, A: 3, B: 2, C: 1, D: 0 }[c.tier]) * 1000 + statSum(c) / 100,
    valueLabel: (c) => `Tier ${c.tier}`,
  },
  {
    id: "draft_kosten",
    label: "Blind Ranking: Teuerste Draft-Picks",
    description: "Ordne die Charaktere nach ihren Draft-Kosten.",
    pool: () => characters,
    value: (c) => c.cost,
    valueLabel: (c) => `${c.cost} Draft-Punkte`,
  },
  {
    id: "teufelskraft_klasse",
    label: "Blind Ranking: Stärkste Teufelskraft-Klasse",
    description: "Ordne die Teufelsfrucht-Nutzer nach Logia > Zoan > Paramecia (Haki als Tiebreaker).",
    pool: () => characters.filter((c) => c.devilFruit),
    value: (c) => {
      const cls = classifyFruit(c.devilFruit);
      const base = cls === "logia" ? 3 : cls === "zoan" ? 2 : cls === "paramecia" ? 1 : 0;
      return base * 1000 + getStrongestVersion(c).stats.haki;
    },
    valueLabel: (c) => {
      const cls = classifyFruit(c.devilFruit);
      return cls ? cls[0].toUpperCase() + cls.slice(1) : "Keine Frucht";
    },
  },
  {
    id: "angriffe_pro_runde",
    label: "Blind Ranking: Meiste Angriffe pro Runde",
    description: "Ordne die Charaktere nach Angriffen pro Kampfrunde (Kampfsimulation).",
    pool: () => characters,
    value: (c) => getStrongestVersion(c).attacksPerRound ?? 1,
    valueLabel: (c) => `${getStrongestVersion(c).attacksPerRound ?? 1} Angriffe/Runde`,
  },
  {
    id: "staerkste_lebende",
    label: "Blind Ranking: Stärkste noch Lebende",
    description: "Ordne die noch lebenden Charaktere nach Gesamtkampfkraft.",
    pool: () => characters.filter((c) => c.alive),
    value: (c) => statSum(c),
    valueLabel: (c) => `${statSum(c)} Gesamtkampfkraft`,
  },
  {
    id: "gefallene_legenden",
    label: "Blind Ranking: Stärkste gefallene Legenden",
    description: "Ordne die verstorbenen Charaktere nach Gesamtkampfkraft.",
    pool: () => characters.filter((c) => !c.alive),
    value: (c) => statSum(c),
    valueLabel: (c) => `${statSum(c)} Gesamtkampfkraft`,
  },
  {
    id: "strohhuete",
    label: "Blind Ranking: Stärkste Strohhüte",
    description: "Ordne die Mitglieder der Strohhutbande nach Gesamtkampfkraft.",
    pool: () => characters.filter((c) => c.crew === "Strohhutbande"),
    value: (c) => statSum(c),
    valueLabel: (c) => `${statSum(c)} Gesamtkampfkraft`,
  },
  {
    id: "logia_nutzer",
    label: "Blind Ranking: Stärkste Logia-Nutzer",
    description: "Ordne die Logia-Nutzer nach Gesamtkampfkraft.",
    pool: () => characters.filter((c) => classifyFruit(c.devilFruit) === "logia"),
    value: (c) => statSum(c),
    valueLabel: (c) => `${statSum(c)} Gesamtkampfkraft`,
  },
  {
    id: "zoan_nutzer",
    label: "Blind Ranking: Stärkste Zoan-Nutzer",
    description: "Ordne die Zoan-Nutzer nach Gesamtkampfkraft.",
    pool: () => characters.filter((c) => classifyFruit(c.devilFruit) === "zoan"),
    value: (c) => statSum(c),
    valueLabel: (c) => `${statSum(c)} Gesamtkampfkraft`,
  },
  {
    id: "paramecia_nutzer",
    label: "Blind Ranking: Stärkste Paramecia-Nutzer",
    description: "Ordne die Paramecia-Nutzer nach Gesamtkampfkraft.",
    pool: () => characters.filter((c) => classifyFruit(c.devilFruit) === "paramecia"),
    value: (c) => statSum(c),
    valueLabel: (c) => `${statSum(c)} Gesamtkampfkraft`,
  },
];

export const BLIND_THEMES: BlindTheme[] = THEME_DEFS.map(({ id, label, description }) => ({ id, label, description }));

// --- Custom (user-created) themes — same localStorage pattern as
// lib/tierCategories.ts's CustomCategory, scoped to Blind Ranking (Q155).

export type BlindStatKey = "staerke" | "haki" | "intelligenz" | "geschwindigkeit" | "durabilitaet" | "gesamtkampfkraft";

export const BLIND_STAT_LABELS: Record<BlindStatKey, string> = {
  staerke: "Stärke",
  haki: "Haki",
  intelligenz: "Intelligenz",
  geschwindigkeit: "Geschwindigkeit",
  durabilitaet: "Durabilität",
  gesamtkampfkraft: "Gesamtkampfkraft",
};

export type CustomBlindTheme = {
  id: string; // "custom:<slug>"
  label: string;
  description: string;
  statKey: BlindStatKey;
  /** Restrict the pool to one crew (as returned by getCrews()), or null for every character. */
  crewFilter: string | null;
};

const CUSTOM_THEMES_KEY = "op-custom-blind-themes";

export function loadCustomBlindThemes(): CustomBlindTheme[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CUSTOM_THEMES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveCustomBlindThemes(themes: CustomBlindTheme[]) {
  try {
    window.localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch {
    // ignore
  }
}

export function createCustomBlindTheme(label: string, statKey: BlindStatKey, crewFilter: string | null): CustomBlindTheme {
  const slug =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `thema-${Date.now()}`;
  const description = `Eigenes Thema: ${BLIND_STAT_LABELS[statKey]}${crewFilter ? ` · ${crewFilter}` : ""}`;
  return { id: `custom:${slug}`, label: label.trim() || "Eigenes Thema", description, statKey, crewFilter };
}

function statValue(c: Character, statKey: BlindStatKey): number {
  if (statKey === "gesamtkampfkraft") return statSum(c);
  return getStrongestVersion(c).stats[statKey];
}

function resolveThemeDef(themeId: string, customThemes: CustomBlindTheme[]): ThemeDef {
  const builtIn = THEME_DEFS.find((t) => t.id === themeId);
  if (builtIn) return builtIn;

  const custom = customThemes.find((t) => t.id === themeId);
  if (custom) {
    return {
      id: custom.id,
      label: custom.label,
      description: custom.description,
      pool: () => (custom.crewFilter ? characters.filter((c) => c.crew === custom.crewFilter) : characters),
      value: (c) => statValue(c, custom.statKey),
      valueLabel: (c) => `${statValue(c, custom.statKey)} ${BLIND_STAT_LABELS[custom.statKey]}`,
    };
  }

  return THEME_DEFS[0];
}

/** Picks a random theme id (built-in or custom) — backs the "Zufallskategorie" mode (Q155). */
export function randomThemeId(customThemes: CustomBlindTheme[] = [], rng: () => number = Math.random): string {
  const allIds = [...THEME_DEFS.map((t) => t.id), ...customThemes.map((t) => t.id)];
  return allIds[Math.floor(rng() * allIds.length)];
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

/** Builds one round: `size` random entries from the theme's pool, in random (hidden) order. */
export function buildRound(
  themeId: string,
  size = 6,
  rng: () => number = Math.random,
  customThemes: CustomBlindTheme[] = []
): BlindEntry[] {
  const def = resolveThemeDef(themeId, customThemes);
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
