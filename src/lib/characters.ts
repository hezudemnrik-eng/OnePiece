import charactersData from "../../data/characters.json";

export type Tier = "S" | "A" | "B" | "C" | "D";

export type Role =
  | "Kapitän"
  | "Erster Offizier"
  | "Kämpfer"
  | "Navigator"
  | "Koch"
  | "Arzt"
  | "Scharfschütze"
  | "Zimmermann"
  | "Musiker"
  | "Archäologe"
  | "Steuermann"
  | "Sonstige";

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
