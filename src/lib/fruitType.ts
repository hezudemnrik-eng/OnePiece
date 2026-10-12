// Classifies a character's devilFruit string into a Devil Fruit class for
// a color accent. Our own data already tags Zoan fruits with "Modell:" in
// the name (see data/characters.json), so that half is exact; Logia is a
// curated list of the well-known elemental/matter fruits in the roster.
// Everything else with a fruit is treated as Paramecia — the catch-all
// class in canon too, so this never needs to be exhaustive to be correct.

const LOGIA_PREFIXES = [
  "Mera Mera",
  "Hie Hie",
  "Moku Moku",
  "Goro Goro",
  "Magu Magu",
  "Suna Suna",
  "Yami Yami",
  "Gasu Gasu",
  "Numa Numa",
  "Yuki Yuki",
];

export type FruitClass = "logia" | "zoan" | "paramecia" | null;

export function classifyFruit(devilFruit: string | null): FruitClass {
  if (!devilFruit) return null;
  if (devilFruit.includes("Modell:")) return "zoan";
  if (LOGIA_PREFIXES.some((p) => devilFruit.startsWith(p))) return "logia";
  return "paramecia";
}

export const FRUIT_COLORS: Record<Exclude<FruitClass, null>, string> = {
  logia: "#e0792a", // elemental amber-orange
  zoan: "#6b8f3c", // beast green
  paramecia: "#7c5cbf", // mystery purple
};
