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
  // Ergänzungen: Charaktere mit klar erkennbarer Anime-Waffe, die vorher fehlte.
  nami: "Kampfstab (Clima-Tact)",
  sentomaru: "Kampfaxt",
  yasopp: "Scharfschützengewehr",
  "van-augur": "Scharfschützengewehr (Präzisionsschüsse)",
  "x-drake": "Streitaxt",
  kaku: "Schwertkampf",
  spandam: "Funkfreed (Elefantenschwert)",
  vergo: "Kampfstab",
  kinemon: "Katana-Schwertkampf (Samurai)",
  kawamatsu: "Schwertkampf (Samurai)",
  inuarashi: "Stockschwert-Kampf",
  yamato: "Kanabo (Kriegskeule)",
  ryuma: "Schwertkampf (Shuusui)",
  wiper: "Kabuto (Kriegskeule)",
  "gan-fall": "Schwertkampf",
  "benn-beckman": "Schusswaffe (Gewehr)",
  queen: "Cyborg-Waffensysteme",
  raizo: "Ninja-Waffen (Shuriken/Kunai)",
  kiku: "Schwertkampf",
  rebecca: "Doppelschwert-Stil",
  cavendish: "Degen-Fechtkunst",
  kyros: "Schwertkampf",
  dorry: "Schwertkampf (Riesenschwert)",
  brogy: "Kampfaxt (Riesenaxt)",
  oden: "Zwei-Schwerter-Stil (Enma & Ame no Habakiri)",
  denjiro: "Schwertkampf",
  "ashura-doji": "Schwertkampf (legendärer Samurai)",
  // Zweite Durchsicht: weitere eindeutige Anime-Kanon-Waffen.
  fujitora: "Schwertkampf",
  izo: "Schwertkampf",
  "mr-4": "Kanone (Lassoo)",
  "miss-doublefinger": "Peitsche",
  "baby-5": "Waffen-Verwandlung (Körperteile zu Schusswaffen)",
  neptune: "Dreizack (Trident)",
  kanjuro: "Pinsel (erschafft Waffen)",
  shinobu: "Ninja-Waffen (Kunai)",
  roger: "Schwertkampf",
  shiki: "Schwertkampf (fliegendes Schwert)",
  alvida: "Morgenstern (Stachelkeule)",
  "don-krieg": "Waffenrüstung (versteckte Kanonen & Raketen)",
  morgan: "Axt-Hand",
  cabaji: "Akrobaten-Schwertkampf",
  mohji: "Peitsche",
  sadi: "Peitsche",
  kuina: "Schwertkampf",
  "t-bone": "Schwertkampf",
  hatchan: "Sechs-Schwerter-Stil",
  manboshi: "Peitsche",
  bellemere: "Schusswaffe (Gewehr)",
  perospero: "Bonbon-Zepter (Kampfstab)",
};

// Confidently non-human races only; everyone else defaults to "Mensch",
// which is correct for the large majority of named One Piece characters.
// Devil Fruit transformations (Zoan users like Dalton, Momonosuke, Yamato)
// don't change a character's base race — only Chopper is special-cased
// below because he was literally a reindeer before his fruit.
const RACES: Record<string, string> = {
  // Fischmensch (Fish-Man)
  jinbe: "Fischmensch",
  arlong: "Fischmensch",
  "hody-jones": "Fischmensch",
  "fisher-tiger": "Fischmensch",
  hatchan: "Fischmensch",
  chew: "Fischmensch",
  kuroobi: "Fischmensch",
  aladine: "Fischmensch",
  // Meermensch (Merfolk/mermaid — a distinct race from Fish-Men in canon)
  neptune: "Meermensch",
  shirahoshi: "Meermensch",
  fukaboshi: "Meermensch",
  ryuboshi: "Meermensch",
  manboshi: "Meermensch",
  otohime: "Meermensch",
  "madam-shyarly": "Meermensch",
  camie: "Meermensch",
  // Chopper's Hito Hito no Mi made him human-like, but he was born a reindeer
  chopper: "Rentier (Mensch-Mensch-Frucht)",
  // Mink (Zou)
  inuarashi: "Mink",
  nekomamushi: "Mink",
  pedro: "Mink",
  carrot: "Mink",
  wanda: "Mink",
  pekoms: "Mink",
  // Riese (Giant)
  dorry: "Riese",
  brogy: "Riese",
  oimo: "Riese",
  kashii: "Riese",
  "jaguar-saul": "Riese",
  hajrudin: "Riese",
  // Zwerg (Tontatta dwarf)
  leo: "Zwerg",
  // Lunarianer — King is confirmed as one of the last Lunarians
  king: "Lunarianer",
  // Oddities worth keeping for flavor
  pappug: "Seestern",
  zunesha: "Elefant",
  // House rule for this app: not a canon One Piece race, kept per request
  "bartholomew-kuma": "Bukanier",
};

const RACE_SCORE: Record<string, number> = {
  Riese: 25,
  Lunarianer: 20,
  Fischmensch: 15,
  Mink: 15,
  Meermensch: 13,
  "Rentier (Mensch-Mensch-Frucht)": 12,
  Bukanier: 10,
  Zwerg: 8,
  Mensch: 5,
  Seestern: 3,
  Elefant: 30,
};

// Legendary mentor figures from canon — flavor only ("trained by a legend"),
// not a claim about any specific, possibly-invented student relationship.
const SENSEI_IDS = ["rayleigh", "zeff", "mihawk", "garp", "kureha", "shanks", "tsuru", "ivankov", "whitebeard", "jinbe"];

function charById(id: string): Character | undefined {
  return characters.find((c) => c.id === id);
}

// Fusion-Piraten soll nur aus kräftigeren Charakteren würfeln (keine
// C/D-Tier-Hintergrundfiguren) — gilt für jede Kategorie, auch beim
// Reroll, da alle Pools unten von dieser gefilterten Liste ausgehen.
const fusionEligibleCharacters = characters.filter((c) => c.tier === "S" || c.tier === "A" || c.tier === "B");

export const FUSION_CATEGORIES: FusionCategory[] = [
  {
    id: "teufelsfrucht",
    label: "Teufelsfrucht",
    pool: () =>
      fusionEligibleCharacters
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
      fusionEligibleCharacters.map((c) => {
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
      fusionEligibleCharacters.map((c) => {
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
      fusionEligibleCharacters.map((c) => {
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
      fusionEligibleCharacters.map((c) => {
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
        .filter((c): c is Character => c != null && (c.tier === "S" || c.tier === "A" || c.tier === "B"))
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
      fusionEligibleCharacters.map((c) => {
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

/** Turns the 7 picked traits into a dramatic, One-Piece-style bounty — a flavor formula for the game, not a canon figure. */
export function computeBounty(picks: FusionOption[]): number {
  const total = picks.reduce((sum, p) => sum + p.score, 0);
  const maxPossible = 90 + 100 + 100 + 85 + 25 + 100 + 100; // rough ceiling across all 7 categories
  const ratio = Math.min(1, total / maxPossible);
  const bounty = Math.pow(ratio, 2.3) * 5_000_000_000;
  return Math.max(3_000_000, Math.round(bounty / 1_000_000) * 1_000_000);
}

export function formatBerry(amount: number): string {
  return `${amount.toLocaleString("de-DE")} Berry`;
}
