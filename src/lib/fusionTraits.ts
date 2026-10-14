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

// Individual mastery score per curated weapon style — Mihawk sits clearly
// on top as the holder of the world's strongest blade; everyone else is
// ranked below him by canon combat weight. A curated style never scores
// below the generic "Unbewaffnet / Nahkampf" baseline (55).
const WEAPON_SCORE: Record<string, number> = {
  mihawk: 95,
  zoro: 88,
  shanks: 85,
  whitebeard: 82,
  rayleigh: 80,
  garp: 78,
  law: 72,
  sanji: 70,
  killer: 68,
  jinbe: 66,
  smoker: 64,
  franky: 64,
  crocodile: 62,
  marco: 60,
  jozu: 60,
  vista: 60,
  brook: 58,
  hawkins: 56,
  tashigi: 56,
  usopp: 55,
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
  // Lunarianer top the list now — in canon the rarest and individually
  // strongest known race (King alone fights at Yonko-commander level),
  // ahead of the previous top spot which went to the one-off "Elefant"
  // flavor tag for Zunesha rather than an actual power-tier race.
  Lunarianer: 35,
  Riese: 28,
  Elefant: 18,
  Fischmensch: 16,
  Mink: 16,
  Meermensch: 13,
  "Rentier (Mensch-Mensch-Frucht)": 12,
  Bukanier: 10,
  Zwerg: 8,
  Mensch: 5,
  Seestern: 3,
};

// Standout fruits that clearly outclass their own class's flat baseline
// (85 Logia / 70 Zoan / 60 Paramecia) — flavor tiering only, not a canon
// power ranking. Everyone else keeps the plain class-based score.
const DEVIL_FRUIT_SCORE_OVERRIDES: Record<string, number> = {
  blackbeard: 100, // hält gleichzeitig Yami Yami und Gura Gura no Mi
  whitebeard: 98, // Gura Gura no Mi — stärkste bekannte Paramecia
  luffy: 96, // Hito Hito no Mi, Modell: Nika — Gear 5
  kaido: 94, // Uo Uo no Mi — "stärkstes Geschöpf der Welt"
  "big-mom": 90, // Soru Soru no Mi — Seelenmanipulation
  akainu: 90, // Magu Magu no Mi — Magma schlägt Feuer
  law: 85, // Ope Ope no Mi — laut Vegapunk "die ultimative Frucht"
  marco: 82, // Tori Tori no Mi, Modell: Phönix — Regeneration
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
          const baseScore = cls === "logia" ? 85 : cls === "zoan" ? 70 : 60;
          const score = DEVIL_FRUIT_SCORE_OVERRIDES[c.id] ?? baseScore;
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
          score: curated ? (WEAPON_SCORE[c.id] ?? 75) : 55,
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

/**
 * `goodTierBonusPercent` (the Fusions-Piraten mode-upgrade's bonus, see
 * migration 0023) biases the roll toward S/A-tier characters — B-tier stays
 * at its base weight, S/A get `1 + bonusPercent/100`×, so a higher upgrade
 * level means a better (but never guaranteed) shot at the strong picks.
 * 0 bonus reproduces the old uniform roll exactly.
 */
export function rollFusionOption(
  categoryId: FusionCategoryId,
  rng: () => number = Math.random,
  goodTierBonusPercent = 0
): FusionOption {
  const category = FUSION_CATEGORIES.find((c) => c.id === categoryId)!;
  const pool = category.pool();
  if (goodTierBonusPercent <= 0) {
    return pool[Math.floor(rng() * pool.length)];
  }

  const weights = pool.map((opt) => {
    const tier = characters.find((c) => c.id === opt.sourceCharacterId)?.tier;
    return tier === "S" || tier === "A" ? 1 + goodTierBonusPercent / 100 : 1;
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * Turns the 7 picked traits into a dramatic, One-Piece-style bounty — a
 * flavor formula for the game, not a canon figure. The ceiling is the exact
 * sum of the best real score in each of the 7 categories (Blackbeard's dual
 * fruit, Imu's haki, Kaido's body, Mihawk's blade, King's race, Mihawk as
 * sensei, Aokiji's mind — 100+99+97+95+35+92.5+99), so the highest bounty
 * actually achievable with real picks is exactly 6 billion Berry, not just
 * a theoretical, unreachable cap.
 */
export function computeBounty(picks: FusionOption[]): number {
  const total = picks.reduce((sum, p) => sum + p.score, 0);
  const maxPossible = 100 + 99 + 97 + 95 + 35 + 92.5 + 99;
  const ratio = Math.min(1, total / maxPossible);
  const bounty = Math.pow(ratio, 2.3) * 6_000_000_000;
  return Math.max(3_000_000, Math.round(bounty / 1_000_000) * 1_000_000);
}

export function formatBerry(amount: number): string {
  return `${amount.toLocaleString("de-DE")} Berry`;
}
