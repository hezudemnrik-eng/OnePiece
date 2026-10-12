import { characters, getCrews } from "./characters";
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

export const BUILT_IN_CATEGORIES: BuiltInCategory[] = [
  {
    id: "characters",
    label: "Charaktere",
    items: characters.map((c) => ({ id: c.id, name: c.name, subtitle: `${c.crew} · ${c.role}`, imageUrl: c.imageUrl })),
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
