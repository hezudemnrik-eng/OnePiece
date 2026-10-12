import quizLoreData from "../../data/quiz-lore.json";
import { characters, getCrews, getStrongestVersion, type Character, type Role, type Stats, type Tier } from "./characters";
import { arcs } from "./arcs";
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

/** Which saga an arc belongs to — pulled from our own curated arcs.ts. */
function generateArcSagaQuestion(rng: () => number): QuizQuestion {
  const arc = pickOne(arcs, rng);
  const sagas = Array.from(new Set(arcs.map((a) => a.saga)));
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
function generateArcOrderQuestion(rng: () => number): QuizQuestion {
  const [ia, ib] = pickTwoDistinct(arcs.map((_, i) => i), rng);
  const a = arcs[ia];
  const b = arcs[ib];
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
function generateIslandSagaQuestion(rng: () => number): QuizQuestion | null {
  const withArc = islands.filter((i) => arcs.some((a) => a.id === i.id));
  if (withArc.length === 0) return null;
  const island = pickOne(withArc, rng);
  const arc = arcs.find((a) => a.id === island.id)!;
  const sagas = Array.from(new Set(arcs.map((a) => a.saga)));
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

/** Dispatches across all generators (character templates + the harder standalone ones above) for variety. */
function generateAnyQuestion(rng: () => number): QuizQuestion | null {
  const generators: Array<() => QuizQuestion | null> = [
    () => generateCharacterQuestion(rng),
    () => generateCharacterQuestion(rng),
    () => generateComparisonQuestion(rng),
    () => generateComparisonQuestion(rng),
    () => generateComparisonQuestion(rng),
    () => generateFruitClassQuestion(rng),
    () => generateArcSagaQuestion(rng),
    () => generateArcOrderQuestion(rng),
    () => generateIslandSagaQuestion(rng),
  ];
  return pickOne(generators, rng)();
}

export type QuizFilters = {
  category?: QuizCategory | "alle";
  difficulty?: QuizDifficulty | "alle";
};

/** Builds a quiz of `count` questions, mixing curated lore questions with auto-generated character questions. */
export function buildQuiz(count: number, filters: QuizFilters = {}, rng: () => number = Math.random): QuizQuestion[] {
  const categoryOk = (cat: QuizCategory) => !filters.category || filters.category === "alle" || filters.category === cat;
  const difficultyOk = (d: QuizDifficulty) => !filters.difficulty || filters.difficulty === "alle" || filters.difficulty === d;

  const pool: QuizQuestion[] = [];
  const loreMatches = shuffle(
    LORE_QUESTIONS.filter((q) => categoryOk(q.category) && difficultyOk(q.difficulty)),
    rng
  );
  pool.push(...loreMatches);

  // Top up with generated questions until we hit `count`, retrying a bounded
  // number of times against the filters. Duplicate ids are skipped — a
  // narrow filter (one category + "schwer") can have a small underlying
  // pool, and re-rolling the same character/template pair would otherwise
  // put the same question in the quiz twice.
  const seenIds = new Set(pool.map((q) => q.id));
  let guard = 0;
  while (pool.length < count && guard < count * 40) {
    guard++;
    const q = generateAnyQuestion(rng);
    if (!q) continue;
    if (seenIds.has(q.id)) continue;
    if (!categoryOk(q.category) || !difficultyOk(q.difficulty)) continue;
    if (q.correct < 0) continue; // defensive: skip if correct value wasn't found in options
    seenIds.add(q.id);
    pool.push(q);
  }

  return shuffle(pool, rng)
    .slice(0, count)
    .map((q) => shuffleOptions(q, rng));
}

export const QUIZ_CATEGORY_LABELS: Record<QuizCategory, string> = {
  charaktere: "Charaktere",
  crews: "Crews",
  teufelsfruechte: "Teufelsfrüchte",
  arcs: "Arcs",
  orte: "Orte",
  ereignisse: "Ereignisse",
  sonstiges: "Sonstiges",
};
