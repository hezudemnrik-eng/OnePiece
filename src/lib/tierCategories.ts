import { characters, getCrews, type Character } from "./characters";
import { classifyFruit } from "./fruitType";
import { arcs } from "./arcs";
import { islands } from "./islands";

export type RankableItem = {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string | null;
};

export type BuiltInCategory = {
  id: string;
  label: string;
  items: RankableItem[];
};

function toItems(pool: Character[]): RankableItem[] {
  return pool.map((c) => ({ id: c.id, name: c.name, subtitle: `${c.crew} · ${c.role}`, imageUrl: c.imageUrl }));
}

/** Shorthand for a character-filtered built-in category — most of the 20 templates (Q94) are one of these. */
function charCategory(id: string, label: string, filter: (c: Character) => boolean): BuiltInCategory {
  return { id, label, items: toItems(characters.filter(filter)) };
}

export const BUILT_IN_CATEGORIES: BuiltInCategory[] = [
  {
    id: "characters",
    label: "Charaktere",
    items: toItems(characters),
  },
  {
    id: "arcs",
    label: "Arcs",
    items: arcs.map((a) => ({ id: a.id, name: a.name, subtitle: a.saga })),
  },
  {
    id: "inseln",
    label: "Inseln",
    items: islands.map((i) => ({ id: i.id, name: i.name })),
  },
  {
    id: "crews",
    label: "Crews",
    items: getCrews().map((crew) => ({ id: crew, name: crew })),
  },
  charCategory("strohhuete", "Strohhutbande", (c) => c.crew === "Strohhutbande"),
  charCategory("marine", "Marine", (c) => c.crew === "Marine"),
  charCategory("weissbart", "Weißbart-Piraten", (c) => c.crew === "Weißbart-Piraten"),
  charCategory("rotbart", "Rotbart-Piraten", (c) => c.crew === "Rotbart-Piraten"),
  charCategory("weltregierung", "Weltregierung", (c) => c.crew === "Weltregierung"),
  charCategory("revolutionsarmee", "Revolutionsarmee", (c) => c.crew === "Revolutionsarmee"),
  charCategory("logia_nutzer", "Logia-Nutzer", (c) => classifyFruit(c.devilFruit) === "logia"),
  charCategory("zoan_nutzer", "Zoan-Nutzer", (c) => classifyFruit(c.devilFruit) === "zoan"),
  charCategory("paramecia_nutzer", "Paramecia-Nutzer", (c) => classifyFruit(c.devilFruit) === "paramecia"),
  charCategory("s_tier", "Elite-Liga (nur S-Tier)", (c) => c.tier === "S"),
  charCategory("lebende", "Noch Lebende", (c) => c.alive),
  charCategory("verstorbene", "Verstorbene", (c) => !c.alive),
  charCategory("kapitaene", "Kapitäne", (c) => c.role === "Kapitän"),
  charCategory("kaempfer", "Kämpfer", (c) => c.role === "Kämpfer"),
  charCategory("aerzte", "Ärzte", (c) => c.role === "Arzt"),
  charCategory("koeche", "Köche", (c) => c.role === "Koch"),
];

export function builtInCategory(id: string): BuiltInCategory | undefined {
  return BUILT_IN_CATEGORIES.find((c) => c.id === id);
}

export type CustomCategory = {
  id: string; // "custom:<slug>"
  label: string;
  items: RankableItem[];
};

const CUSTOM_CATEGORIES_KEY = "op-custom-categories";

export function loadCustomCategories(): CustomCategory[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CUSTOM_CATEGORIES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveCustomCategories(categories: CustomCategory[]) {
  try {
    window.localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    // ignore
  }
}

export function createCustomCategory(label: string, itemNames: string[]): CustomCategory {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `kategorie-${Date.now()}`;
  return {
    id: `custom:${slug}`,
    label: label.trim() || "Eigene Kategorie",
    items: itemNames
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name, i) => ({ id: `${slug}-${i}`, name })),
  };
}
