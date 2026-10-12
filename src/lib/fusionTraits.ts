import { characters, getStrongestVersion, type Character } from "./characters";
import { classifyFruit } from "./fruitType";

export type FusionCategoryId = "teufelsfrucht" | "haki" | "body" | "weapon" | "race" | "sensei" | "mind";

export type FusionOption = {
  categoryId: FusionCategoryId;
  sourceCharacterId: string;
  sourceName: string;
  sourceImageUrl?: string | null;
  traitLabel: string;
  /** Rough 0-100ish contribution toward the final bounty — a flavor score, not a canon stat. */
  score: number;
};

export type FusionCategory = {
  id: FusionCategoryId;
  label: string;
  pool: () => FusionOption[];
};

function hakiLabel(value: number): string {
  if (value >= 90) return "Außergewöhnliches Haki";
  if (value >= 70) return "Starkes, trainiertes Haki";
  if (value >= 40) return "Spürbares Haki";
  return "Kaum trainiertes Haki";
}

function mindLabel(value: number): string {
  if (value >= 90) return "Strategisches Genie";
  if (value >= 70) return "Scharfer Verstand";
  if (value >= 40) return "Durchschnittlicher Verstand";
  return "Impulsiv, kaum Taktik";
}

// Broad, confidently-known fighting styles — kept generic ("Schwertkampf"
// rather than inventing exact named techniques) wherever the precise detail
// isn't certain. Anyone not listed here defaults to "Unbewaffnet / Nahkampf",
// which is true for the large majority of the (mostly background) roster.
const WEAPON_STYLES: Record<string, string> = {
  zoro: "Drei-Schwerter-Stil (Santoryu)",
  sanji: "Reiner Beinkampf (Black Leg)",
  usopp: "Fernkampf: Kabuto-Schleuder",
  killer: "Doppelsicheln",
  mihawk: "Schwertkampf (stärkste Klinge der Welt)",
  smoker: "Jutte",
  tashigi: "Schwertkampf",
  brook: "Degen-Fechtkunst",
  vista: "Doppelschwert-Stil",
  law: "Nodachi-Schwertkampf",
  hawkins: "Schwert & Karten",
  franky: "Cyborg-Waffensysteme",
  jinbe: "Fischmensch-Karate",
  whitebeard: "Naginata-Kampf",
  shanks: "Schwertkampf",
  marco: "Krallen-Nahkampf",
  jozu: "Fäuste",
  crocodile: "Hakenhand-Nahkampf",
  garp: "Bloßer Faustkampf",
  rayleigh: "Schwertkampf",
};

// Confidently non-human races only; everyone else defaults to "Mensch",
// which is correct for the large majority of named One Piece characters.
const RACES: Record<string, string> = {
  jinbe: "Fischmensch",
  arlong: "Fischmensch",
  "hody-jones": "Fischmensch",
  chopper: "Rentier (Mensch-Mensch-Frucht)",
  inuarashi: "Mink",
  nekomamushi: "Mink",
  pedro: "Mink",
  carrot: "Mink",
  dorry: "Riese",
  oimo: "Riese",
  kashii: "Riese",
  "jaguar-saul": "Riese",
};

const RACE_SCORE: Record<string, number> = {
  Riese: 25,
  Fischmensch: 15,
  Mink: 15,
  "Rentier (Mensch-Mensch-Frucht)": 12,
  Mensch: 5,
};

// Legendary mentor figures from canon — flavor only ("trained by a legend"),
// not a claim about any specific, possibly-invented student relationship.
const SENSEI_IDS = ["rayleigh", "zeff", "mihawk", "garp", "kureha", "shanks", "tsuru", "ivankov", "whitebeard", "jinbe"];

function charById(id: string): Character | undefined {
  return characters.find((c) => c.id === id);
}

export const FUSION_CATEGORIES: FusionCategory[] = [
  {
    id: "teufelsfrucht",
    label: "Teufelsfrucht",
    pool: () =>
      characters
        .filter((c) => c.devilFruit)
        .map((c) => {
          const cls = classifyFruit(c.devilFruit);
          const score = cls === "logia" ? 85 : cls === "zoan" ? 70 : 60;
          return {
            categoryId: "teufelsfrucht" as const,
            sourceCharacterId: c.id,
            sourceName: c.name,
            sourceImageUrl: c.imageUrl,
            traitLabel: c.devilFruit as string,
            score,
          };
        }),
  },
  {
    id: "haki",
    label: "Haki",
    pool: () =>
      characters.map((c) => {
        const haki = getStrongestVersion(c).stats.haki;
        return {
          categoryId: "haki" as const,
          sourceCharacterId: c.id,
          sourceName: c.name,
          sourceImageUrl: c.imageUrl,
          traitLabel: `${hakiLabel(haki)} (${haki})`,
          score: haki,
        };
      }),
  },
  {
    id: "body",
    label: "Body",
    pool: () =>
      characters.map((c) => {
        const { staerke, durabilitaet } = getStrongestVersion(c).stats;
        return {
          categoryId: "body" as const,
          sourceCharacterId: c.id,
          sourceName: c.name,
          sourceImageUrl: c.imageUrl,
          traitLabel: `Kraft ${staerke} / Widerstand ${durabilitaet}`,
          score: (staerke + durabilitaet) / 2,
        };
      }),
  },
  {
    id: "weapon",
    label: "Weapon",
    pool: () =>
      characters.map((c) => {
        const curated = WEAPON_STYLES[c.id];
        return {
          categoryId: "weapon" as const,
          sourceCharacterId: c.id,
          sourceName: c.name,
          sourceImageUrl: c.imageUrl,
          traitLabel: curated ?? "Unbewaffnet / Nahkampf",
          score: curated ? 75 : 55,
        };
      }),
  },
  {
    id: "race",
    label: "Race",
    pool: () =>
      characters.map((c) => {
        const race = RACES[c.id] ?? "Mensch";
        return {
          categoryId: "race" as const,
          sourceCharacterId: c.id,
          sourceName: c.name,
          sourceImageUrl: c.imageUrl,
          traitLabel: race,
          score: RACE_SCORE[race] ?? 5,
        };
      }),
  },
  {
    id: "sensei",
    label: "Sensei",
    pool: () =>
      SENSEI_IDS.map(charById)
        .filter((c): c is Character => Boolean(c))
        .map((c) => {
          const { haki, intelligenz } = getStrongestVersion(c).stats;
          return {
            categoryId: "sensei" as const,
            sourceCharacterId: c.id,
            sourceName: c.name,
            sourceImageUrl: c.imageUrl,
            traitLabel: `Mentor: ${c.name}`,
            score: (haki + intelligenz) / 2,
          };
        }),
  },
  {
    id: "mind",
    label: "Mind",
    pool: () =>
      characters.map((c) => {
        const intelligenz = getStrongestVersion(c).stats.intelligenz;
        return {
          categoryId: "mind" as const,
          sourceCharacterId: c.id,
          sourceName: c.name,
          sourceImageUrl: c.imageUrl,
          traitLabel: `${mindLabel(intelligenz)} (${intelligenz})`,
          score: intelligenz,
        };
      }),
  },
];

export function rollFusionOption(categoryId: FusionCategoryId, rng: () => number = Math.random): FusionOption {
  const category = FUSION_CATEGORIES.find((c) => c.id === categoryId)!;
  const pool = category.pool();
  return pool[Math.floor(rng() * pool.length)];
}
