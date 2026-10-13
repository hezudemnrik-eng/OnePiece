import { characters, type Character } from "./characters";

// A small curated roster (rather than all ~300 characters) for the avatar
// picker shown at signup (AuthGate) and later changeable for free from the
// profile (ProfileBoard) — shared here so both stay in sync. The other 7
// starter-roster faces (sanji, robin, franky, brook, jinbe, shanks, ace)
// moved into the Berry shop's 'avatar' category (migration 0018) so
// leveling/spending unlocks more of them; existing users keep whichever
// one they already had equipped (see that migration's grandfather clause).
const AVATAR_CHOICE_IDS = ["luffy", "zoro", "nami", "usopp", "chopper"];

export const AVATAR_CHOICES: Character[] = AVATAR_CHOICE_IDS.map((id) => characters.find((c) => c.id === id)).filter(
  (c): c is Character => Boolean(c)
);
