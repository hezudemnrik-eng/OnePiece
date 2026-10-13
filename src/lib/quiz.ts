import quizLoreData from "../../data/quiz-lore.json";
import { characters, getCrews, getStrongestVersion, type Character, type Role, type Stats, type Tier } from "./characters";
import { arcs, type Arc } from "./arcs";
import { islands } from "./islands";
import { classifyFruit } from "./fruitType";

export type QuizCategory = "charaktere" | "crews" | "teufelsfruechte" | "arcs" | "orte" | "ereignisse" | "sonstiges";
export type QuizDifficulty = "leicht" | "mittel" | "schwer";

export type QuizQuestion = {
  id: string;
  category: QuizCategory;
  difficulty: QuizDifficulty;
  prompt: string;
  imageUrl?: string | null;
  options: string[];
  correct: number;
};

type LoreRow = {
  id: string;
  category: string;
  difficulty: QuizDifficulty;
  prompt: string;
  options: string[];
  correct: number;
};

const LORE_QUESTIONS: QuizQuestion[] = (quizLoreData as LoreRow[]).map((r) => ({
  id: r.id,
  category: r.category as QuizCategory,
  difficulty: r.difficulty,
  prompt: r.prompt,
  options: r.options,
  correct: r.correct,
}));

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickOne<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Shuffles a question's options and remaps `correct` to the new position. */
function shuffleOptions(q: QuizQuestion, rng: () => number): QuizQuestion {
  const correctValue = q.options[q.correct];
  const options = shuffle(q.options, rng);
  return { ...q, options, correct: options.indexOf(correctValue) };
}

function tierDifficulty(tier: Tier): QuizDifficulty {
  if (tier === "S" || tier === "A") return "leicht";
  if (tier === "B") return "mittel";
  return "schwer";
}

function distractors<T>(pool: T[], exclude: T, count: number, rng: () => number): T[] {
  const candidates = pool.filter((x) => x !== exclude);
  return shuffle(candidates, rng).slice(0, count);
}

const ALL_ROLES: Role[] = [
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
  "Sonstige",
];

/** Generates one multiple-choice question about a random character from the roster. */
function generateCharacterQuestion(rng: () => number): QuizQuestion {
  const c: Character = pickOne(characters, rng);
  const templates: Array<() => QuizQuestion> = [
    () => {
      const crews = getCrews();
      const wrong = distractors(crews, c.crew, 3, rng);
      return {
        id: `gen-crew-${c.id}`,
        category: "crews",
        difficulty: tierDifficulty(c.tier),
        prompt: `Welcher Crew gehört ${c.name} an?`,
        options: shuffle([c.crew, ...wrong], rng),
        correct: 0, // overwritten below after shuffle
      };
    },
    () => {
      const wrong = distractors(ALL_ROLES, c.role, 3, rng);
      return {
        id: `gen-role-${c.id}`,
        category: "charaktere",
        difficulty: tierDifficulty(c.tier),
        prompt: `Welche Rolle hat ${c.name}?`,
        options: shuffle([c.role, ...wrong], rng),
        correct: 0,
      };
    },
    () => {
      const tiers: Tier[] = ["S", "A", "B", "C", "D"];
      const wrong = distractors(tiers, c.tier, 3, rng);
      return {
        id: `gen-tier-${c.id}`,
        category: "charaktere",
        difficulty: "mittel",
        prompt: `Welchem Tier wird ${c.name} in dieser App zugeordnet?`,
        options: shuffle([c.tier, ...wrong], rng),
        correct: 0,
      };
    },
    () => {
      const isAlive = c.alive;
      return {
        id: `gen-alive-${c.id}`,
        category: "charaktere",
        difficulty: tierDifficulty(c.tier),
        prompt: `Ist ${c.name} noch am Leben (Stand aktuelle Story)?`,
        options: ["Ja", "Nein"],
        correct: isAlive ? 0 : 1,
      };
    },
    () => {
      const hasFruit = c.devilFruit !== null;
      return {
        id: `gen-fruit-${c.id}`,
        category: "teufelsfruechte",
        difficulty: tierDifficulty(c.tier),
        prompt: `Besitzt ${c.name} eine Teufelsfrucht?`,
        options: ["Ja", "Nein"],
        correct: hasFruit ? 0 : 1,
      };
    },
  ];

  // Image question: only when the character has a portrait to show.
  if (c.imageUrl) {
    templates.push(() => {
      const wrong = distractors(characters, c, 3, rng).map((x) => x.name);
      return {
        id: `gen-image-${c.id}`,
        category: "charaktere",
        difficulty: tierDifficulty(c.tier),
        prompt: "Wer ist auf diesem Bild zu sehen?",
        imageUrl: c.imageUrl,
        options: shuffle([c.name, ...wrong], rng),
        correct: 0,
      };
    });
  }

  const template = pickOne(templates, rng);
  const q = template();
  const correctValue =
    q.prompt.includes("Crew")
      ? c.crew
      : q.prompt.includes("Rolle")
        ? c.role
        : q.prompt.includes("Tier")
          ? c.tier
          : q.prompt.startsWith("Wer ist auf diesem Bild")
            ? c.name
            : null;
  if (correctValue !== null) {
    q.correct = q.options.indexOf(correctValue);
  }
  return q;
}

const STAT_LABELS: Record<keyof Stats, string> = {
  staerke: "Stärke",
  haki: "Haki",
  intelligenz: "Intelligenz",
  geschwindigkeit: "Geschwindigkeit",
  durabilitaet: "Durabilität",
};
const STAT_KEYS = Object.keys(STAT_LABELS) as (keyof Stats)[];

function pickTwoDistinct<T>(arr: T[], rng: () => number): [T, T] {
  const a = pickOne(arr, rng);
  let b = pickOne(arr, rng);
  let guard = 0;
  while (b === a && guard++ < 20) b = pickOne(arr, rng);
  return [a, b];
}

/** Harder template: which of two characters scores higher on a given stat — ground truth comes straight from our own stat data, never invented lore. */
function generateComparisonQuestion(rng: () => number): QuizQuestion {
  const [a, b] = pickTwoDistinct(characters, rng);
  const statKey = pickOne(STAT_KEYS, rng);
  const valueA = getStrongestVersion(a).stats[statKey];
  const valueB = getStrongestVersion(b).stats[statKey];
  const diff = Math.abs(valueA - valueB);
  const difficulty: QuizDifficulty = diff <= 8 ? "schwer" : diff <= 25 ? "mittel" : "leicht";
  const correctValue = valueA >= valueB ? a.name : b.name;
  const options = shuffle([a.name, b.name], rng);
  return {
    id: `gen-cmp-${statKey}-${a.id}-${b.id}`,
    category: "charaktere",
    difficulty,
    prompt: `Wer hat mehr ${STAT_LABELS[statKey]}: ${a.name} oder ${b.name}?`,
    options,
    correct: options.indexOf(correctValue),
  };
}

const FRUIT_CLASS_LABELS: Record<"logia" | "zoan" | "paramecia", string> = {
  logia: "Logia",
  zoan: "Zoan",
  paramecia: "Paramecia",
};

/** Devil fruit class, derived from our own curated classifyFruit() logic — not freehand lore. */
function generateFruitClassQuestion(rng: () => number): QuizQuestion | null {
  const withFruit = characters.filter((c) => c.devilFruit);
  if (withFruit.length === 0) return null;
  const c = pickOne(withFruit, rng);
  const cls = classifyFruit(c.devilFruit);
  if (!cls) return null;
  const options = shuffle(Object.values(FRUIT_CLASS_LABELS), rng);
  return {
    id: `gen-fruitclass-${c.id}`,
    category: "teufelsfruechte",
    difficulty: "schwer",
    prompt: `Zu welcher Klasse gehört die Teufelsfrucht von ${c.name} (${c.devilFruit})?`,
    options,
    correct: options.indexOf(FRUIT_CLASS_LABELS[cls]),
  };
}

/** Which saga an arc belongs to — pulled from our own curated arcs.ts. `arcPool` lets the spoiler filter (Q128) restrict this to arcs up to the player's story progress. */
function generateArcSagaQuestion(rng: () => number, arcPool: Arc[]): QuizQuestion | null {
  if (arcPool.length === 0) return null;
  const arc = pickOne(arcPool, rng);
  const sagas = Array.from(new Set(arcPool.map((a) => a.saga)));
  if (sagas.length < 2) return null; // not enough distinct sagas yet for a meaningful wrong-answer set
  const wrong = distractors(sagas, arc.saga, 3, rng);
  const options = shuffle([arc.saga, ...wrong], rng);
  return {
    id: `gen-arcsaga-${arc.id}`,
    category: "arcs",
    difficulty: "mittel",
    prompt: `Zu welcher Saga gehört der Arc „${arc.name}“?`,
    options,
    correct: options.indexOf(arc.saga),
  };
}

/** Chronological order between two arcs — arcs.ts is already listed in story order. */
function generateArcOrderQuestion(rng: () => number, arcPool: Arc[]): QuizQuestion | null {
  if (arcPool.length < 2) return null;
  const [ia, ib] = pickTwoDistinct(arcPool.map((_, i) => i), rng);
  const a = arcPool[ia];
  const b = arcPool[ib];
  const correctName = ia < ib ? a.name : b.name;
  const options = shuffle([a.name, b.name], rng);
  return {
    id: `gen-arcorder-${a.id}-${b.id}`,
    category: "arcs",
    difficulty: "schwer",
    prompt: `Welcher Arc kommt in der Handlung zuerst: „${a.name}“ oder „${b.name}“?`,
    options,
    correct: options.indexOf(correctName),
  };
}

/** Which saga an island's arc belongs to — only for islands that share an id with a curated arc, so nothing is guessed. */
function generateIslandSagaQuestion(rng: () => number, arcPool: Arc[]): QuizQuestion | null {
  const withArc = islands.filter((i) => arcPool.some((a) => a.id === i.id));
  if (withArc.length === 0) return null;
  const island = pickOne(withArc, rng);
  const arc = arcPool.find((a) => a.id === island.id)!;
  const sagas = Array.from(new Set(arcPool.map((a) => a.saga)));
  if (sagas.length < 2) return null;
  const wrong = distractors(sagas, arc.saga, 3, rng);
  const options = shuffle([arc.saga, ...wrong], rng);
  return {
    id: `gen-islandsaga-${island.id}`,
    category: "orte",
    difficulty: "mittel",
    prompt: `Zu welcher Saga gehört die Insel „${island.name}“?`,
    options,
    correct: options.indexOf(arc.saga),
  };
}

/** Dispatches across all generators (character templates + the harder standalone ones above) for variety. `arcPool` is the spoiler-filtered subset of arcs.ts (Q128), full arcs list when no filter is set. */
function generateAnyQuestion(rng: () => number, arcPool: Arc[]): QuizQuestion | null {
  const generators: Array<() => QuizQuestion | null> = [
    () => generateCharacterQuestion(rng),
    () => generateCharacterQuestion(rng),
    () => generateComparisonQuestion(rng),
    () => generateComparisonQuestion(rng),
    () => generateComparisonQuestion(rng),
    () => generateFruitClassQuestion(rng),
    () => generateArcSagaQuestion(rng, arcPool),
    () => generateArcOrderQuestion(rng, arcPool),
    () => generateIslandSagaQuestion(rng, arcPool),
  ];
  return pickOne(generators, rng)();
}

export type QuizFilters = {
  category?: QuizCategory | "alle";
  difficulty?: QuizDifficulty | "alle";
  /**
   * Spoiler protection (Q128): only arc/island-saga questions about arcs up
   * to and including this index into arcs.ts (which is already in story
   * order) are generated. Undefined = no restriction. Character/stat/lore
   * questions aren't story-ordered in the underlying data, so this only
   * covers the three arc- and island-based generators.
   */
  maxArcIndex?: number;
};

/**
 * Builds a quiz of `count` questions, mixing curated lore questions with
 * auto-generated character questions. `excludeIds` (Q121 — no repeats
 * across sessions, see lib/quizHistory.ts) is skipped on a first pass; if
 * the filtered pool is too small to reach `count` without reusing them, a
 * second pass tops up ignoring `excludeIds` rather than returning fewer
 * questions than asked for.
 */
export function buildQuiz(
  count: number,
  filters: QuizFilters = {},
  rng: () => number = Math.random,
  excludeIds: Set<string> = new Set()
): QuizQuestion[] {
  const categoryOk = (cat: QuizCategory) => !filters.category || filters.category === "alle" || filters.category === cat;
  const difficultyOk = (d: QuizDifficulty) => !filters.difficulty || filters.difficulty === "alle" || filters.difficulty === d;
  const arcPool = filters.maxArcIndex === undefined ? arcs : arcs.slice(0, filters.maxArcIndex + 1);

  const pool: QuizQuestion[] = [];
  const loreMatches = shuffle(
    LORE_QUESTIONS.filter((q) => categoryOk(q.category) && difficultyOk(q.difficulty) && !excludeIds.has(q.id)),
    rng
  );
  pool.push(...loreMatches);

  const seenIds = new Set(pool.map((q) => q.id));
  function fillFrom(guardLimit: number, respectExclude: boolean) {
    let guard = 0;
    while (pool.length < count && guard < guardLimit) {
      guard++;
      const q = generateAnyQuestion(rng, arcPool);
      if (!q) continue;
      if (seenIds.has(q.id)) continue;
      if (respectExclude && excludeIds.has(q.id)) continue;
      if (!categoryOk(q.category) || !difficultyOk(q.difficulty)) continue;
      if (q.correct < 0) continue; // defensive: skip if correct value wasn't found in options
      seenIds.add(q.id);
      pool.push(q);
    }
  }

  // First pass: avoid recently-seen questions. A narrow filter (one
  // category + "schwer", or a small spoiler-filtered arc pool) can have a
  // small underlying question space, so a second pass tops up ignoring
  // excludeIds rather than silently returning fewer questions than asked.
  fillFrom(count * 40, true);
  fillFrom(count * 40, false);

  return shuffle(pool, rng)
    .slice(0, count)
    .map((q) => shuffleOptions(q, rng));
}

/**
 * One entry per saga, in story order, each paired with the arcs.ts index of
 * that saga's last arc — backs the "Spoiler-Schutz" picker (Q128): choosing
 * a saga sets `maxArcIndex` to its value, so arc/island questions never
 * reach past where the player says they are in the story.
 */
export const QUIZ_SPOILER_SAGAS: { saga: string; maxArcIndex: number }[] = arcs.reduce<{ saga: string; maxArcIndex: number }[]>(
  (acc, arc, i) => {
    const last = acc.find((s) => s.saga === arc.saga);
    if (last) last.maxArcIndex = i;
    else acc.push({ saga: arc.saga, maxArcIndex: i });
    return acc;
  },
  []
);

export const QUIZ_CATEGORY_LABELS: Record<QuizCategory, string> = {
  charaktere: "Charaktere",
  crews: "Crews",
  teufelsfruechte: "Teufelsfrüchte",
  arcs: "Arcs",
  orte: "Orte",
  ereignisse: "Ereignisse",
  sonstiges: "Sonstiges",
};
