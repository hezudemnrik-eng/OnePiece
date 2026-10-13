import type { ModeAccent } from "@/components/ui/modeAccents";

export type DailyChallenge = {
  text: string;
  href: string;
  icon: string;
  accent: ModeAccent;
};

// A fixed pool, picked deterministically by day-of-year so everyone sees the
// same challenge on a given day (Q64). Display-only for now — no XP/reward
// hook yet, that lands with the gamification pass (Phase 5).
const CHALLENGE_POOL: DailyChallenge[] = [
  { text: "Gewinne ein Duell gegen einen S-Tier-Charakter.", href: "/duell", icon: "⚡", accent: "duell" },
  { text: "Beantworte 5 Quiz-Fragen hintereinander richtig.", href: "/quiz", icon: "❓", accent: "quiz" },
  { text: "Stelle eine komplette Crew mit Synergie-Bonus zusammen.", href: "/crew", icon: "🧭", accent: "crew" },
  { text: "Würfle einen Fusions-Piraten mit über 1 Mrd. Berry Kopfgeld.", href: "/fusion", icon: "🧬", accent: "fusion" },
  { text: "Erstelle eine neue Tierliste zu einem Arc deiner Wahl.", href: "/tierlisten", icon: "📜", accent: "tierlisten" },
  { text: "Ordne eine Blind-Ranking-Runde perfekt ein.", href: "/blind-ranking", icon: "🙈", accent: "blind-ranking" },
  { text: "Schließe einen Solo-Draft ohne eine einzige Niederlage ab.", href: "/draft", icon: "⚔️", accent: "draft" },
  { text: "Besiege Imu — oder stirb's wenigstens in Würde versuchend.", href: "/imu", icon: "👁️", accent: "imu" },
  { text: "Gewinne gegen einen Zufallsgegner mit einem B-Tier-Team.", href: "/zufallsgegner", icon: "🎲", accent: "zufallsgegner" },
  { text: "Starte einen Live-Draft mit einem Freund.", href: "/draft/live", icon: "🌐", accent: "draft" },
  { text: "Beantworte eine Quiz-Frage zu einem frühen Arc richtig.", href: "/quiz", icon: "❓", accent: "quiz" },
  { text: "Ranke deine Top-5-Lieblingscharaktere in einer Tierliste.", href: "/tierlisten", icon: "📜", accent: "tierlisten" },
  { text: "Bringe eine Crew auf Grade S.", href: "/crew", icon: "🧭", accent: "crew" },
  { text: "Spiele ein Duell mit einem Charakter, den du noch nie genutzt hast.", href: "/duell", icon: "⚡", accent: "duell" },
];

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / 86_400_000);
}

export function getTodaysChallenge(date: Date = new Date()): DailyChallenge {
  const index = dayOfYear(date) % CHALLENGE_POOL.length;
  return CHALLENGE_POOL[index];
}
