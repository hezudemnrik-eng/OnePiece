import { characters, type Character } from "./characters";

// A small curated roster (rather than all ~300 characters) for the avatar
// picker shown at signup (AuthGate) and later changeable from the profile
// (ProfileBoard) — shared here so both stay in sync.
const AVATAR_CHOICE_IDS = [
  "luffy",
  "zoro",
  "nami",
  "usopp",
  "sanji",
  "chopper",
  "robin",
  "franky",
  "brook",
  "jinbe",
  "shanks",
  "ace",
];

export const AVATAR_CHOICES: Character[] = AVATAR_CHOICE_IDS.map((id) => characters.find((c) => c.id === id)).filter(
  (c): c is Character => Boolean(c)
);
