import quizLoreData from "../../data/quiz-lore.json";
import { characters, getCrews, type Character, type Role, type Tier } from "./characters";

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

  // Top up with generated character questions until we hit `count`, retrying
  // a bounded number of times against the filters (character roster + the
  // template mix comfortably covers "charaktere"/"crews"/"teufelsfruechte").
  let guard = 0;
  while (pool.length < count && guard < count * 20) {
    guard++;
    const q = generateCharacterQuestion(rng);
    if (!categoryOk(q.category) || !difficultyOk(q.difficulty)) continue;
    if (q.correct < 0) continue; // defensive: skip if correct value wasn't found in options
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
