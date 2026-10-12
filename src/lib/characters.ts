import charactersData from "../../data/characters.json";

export type Tier = "S" | "A" | "B" | "C" | "D";

export const ROLES = [
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
] as const;

export type Role = (typeof ROLES)[number];

export type Stats = {
  staerke: number;
  haki: number;
  intelligenz: number;
  geschwindigkeit: number;
  durabilitaet: number;
};

export type CharacterVersion = {
  id: string;
  label: string;
  stats: Stats;
  /** How many attacks this fighter gets per battle round (default 1). Used by boss fights such as Imu, who fights alone against a full team and would otherwise be hopelessly outnumbered on actions. */
  attacksPerRound?: number;
};

export type Character = {
  id: string;
  name: string;
  crew: string;
  role: Role;
  tier: Tier;
  devilFruit: string | null;
  alive: boolean;
  cost: number;
  versions: CharacterVersion[];
  /** Portrait image URL (One Piece Fandom wiki). Null when no image was found. */
  imageUrl?: string | null;
};

export const characters: Character[] = charactersData as Character[];

export function getCharacterById(id: string): Character | undefined {
  return characters.find((c) => c.id === id);
}

export function getDefaultVersion(character: Character): CharacterVersion {
  return character.versions[0];
}

export function getCrews(): string[] {
  return Array.from(new Set(characters.map((c) => c.crew))).sort();
}

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];

export function sortByTier(list: Character[]): Character[] {
  return [...list].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
  );
}
