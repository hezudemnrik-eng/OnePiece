import type { ModeAccent } from "@/components/ui/modeAccents";

/**
 * Stable id used to detect completion (see claimDailyQuestFor() in
 * supabase.ts) — several pool entries intentionally share an id so the
 * flavor text can stay varied while detection stays simple: completing
 * *any* run of that mode counts, not the exact flavor described (no
 * S-/B-Tier-Gegner or "ungenutzter Charakter" tracking exists yet).
 */
export type DailyQuestId =
  | "duell"
  | "quiz-1"
  | "quiz-5"
  | "crew"
  | "fusion-1b"
  | "tierliste"
  | "blind-ranking"
  | "zufallsgegner"
  | "imu"
  | "live-draft";

export type DailyChallenge = {
  id: DailyQuestId;
  text: string;
  href: string;
  icon: string;
  accent: ModeAccent;
};

// A fixed pool, picked deterministically by day-of-year so everyone sees the
// same challenge on a given day (Q64). Completing it awards a one-time bonus
// (DAILY_QUEST_XP_BONUS/DAILY_QUEST_BERRY_BONUS in levels.ts) via
// claimDailyQuestFor() in supabase.ts and is tracked per-user/per-day in the
// daily_quest_claims table (migration 0020).
const CHALLENGE_POOL: DailyChallenge[] = [
  { id: "duell", text: "Gewinne ein Duell gegen einen S-Tier-Charakter.", href: "/duell", icon: "⚡", accent: "duell" },
  { id: "quiz-5", text: "Beantworte 5 Quiz-Fragen hintereinander richtig.", href: "/quiz", icon: "❓", accent: "quiz" },
  { id: "crew", text: "Stelle eine komplette Crew mit Synergie-Bonus zusammen.", href: "/crew", icon: "🧭", accent: "crew" },
  { id: "fusion-1b", text: "Würfle einen Fusions-Piraten mit über 1 Mrd. Berry Kopfgeld.", href: "/fusion", icon: "🧬", accent: "fusion" },
  { id: "tierliste", text: "Erstelle eine neue Tierliste zu einem Arc deiner Wahl.", href: "/tierlisten", icon: "📜", accent: "tierlisten" },
  { id: "blind-ranking", text: "Ordne eine Blind-Ranking-Runde perfekt ein.", href: "/blind-ranking", icon: "🙈", accent: "blind-ranking" },
  { id: "zufallsgegner", text: "Schließe einen Solo-Draft ohne eine einzige Niederlage ab.", href: "/draft", icon: "⚔️", accent: "draft" },
  { id: "imu", text: "Besiege Imu — oder stirb's wenigstens in Würde versuchend.", href: "/imu", icon: "👁️", accent: "imu" },
  { id: "zufallsgegner", text: "Gewinne gegen einen Zufallsgegner mit einem B-Tier-Team.", href: "/zufallsgegner", icon: "🎲", accent: "zufallsgegner" },
  { id: "live-draft", text: "Starte einen Live-Draft mit einem Freund.", href: "/draft/live", icon: "🌐", accent: "draft" },
  { id: "quiz-1", text: "Beantworte eine Quiz-Frage zu einem frühen Arc richtig.", href: "/quiz", icon: "❓", accent: "quiz" },
  { id: "tierliste", text: "Ranke deine Top-5-Lieblingscharaktere in einer Tierliste.", href: "/tierlisten", icon: "📜", accent: "tierlisten" },
  { id: "crew", text: "Bringe eine Crew auf Grade S.", href: "/crew", icon: "🧭", accent: "crew" },
  { id: "duell", text: "Spiele ein Duell mit einem Charakter, den du noch nie genutzt hast.", href: "/duell", icon: "⚡", accent: "duell" },
];

// Boss and every player are in Germany, so "today" has to mean the
// Europe/Berlin calendar day, not UTC. Using getUTC*() here previously
// rolled the quest (and, via todayKeyBerlin() below, the claimed flag)
// over at UTC midnight = 1-2am local depending on DST, so right after
// local midnight the app still showed yesterday's (already claimed)
// quest — looking exactly like it was "stuck", not "updated".
function berlinDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

function dayOfYear(date: Date): number {
  const { year, month, day } = berlinDateParts(date);
  const start = Date.UTC(year, 0, 0);
  const diff = Date.UTC(year, month, day) - start;
  return Math.floor(diff / 86_400_000);
}

export function getTodaysChallenge(date: Date = new Date()): DailyChallenge {
  const index = dayOfYear(date) % CHALLENGE_POOL.length;
  return CHALLENGE_POOL[index];
}

/**
 * The Europe/Berlin calendar day as "YYYY-MM-DD", matching the `claim_date`
 * the claim_daily_quest() RPC now writes (migration 0026) — both sides of
 * the "already claimed today" check must agree on what day it is.
 */
export function todayKeyBerlin(date: Date = new Date()): string {
  const { year, month, day } = berlinDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
