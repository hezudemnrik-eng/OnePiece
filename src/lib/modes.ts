import type { MatchMode } from "./supabase";

export type GameMode = {
  href: string;
  icon: string;
  title: string;
  desc: string;
  matchMode?: MatchMode;
};

/** Every game mode's nav entry — shared by the home overview grid and the sidebar/hamburger nav. */
export const MODES: GameMode[] = [
  { href: "/draft", icon: "⚔️", title: "PvP-Draft gegen Freunde", desc: "Snake-Draft im Hotseat, danach Kampfsimulation." },
  { href: "/draft/live", icon: "🌐", title: "Live-Draft (mehrere Geräte)", desc: "Lobby mit Code teilen, jeder draftet von seinem Gerät.", matchMode: "live-draft" },
  { href: "/imu", icon: "👁️", title: "Gegen Imu", desc: "Solo-Draft gegen einen übermächtigen Boss-Gegner.", matchMode: "imu" },
  { href: "/zufallsgegner", icon: "🎲", title: "Gegen Zufallsgegner", desc: "Ranked-Übungsrunde gegen eine leichtere KI.", matchMode: "zufallsgegner" },
  { href: "/duell", icon: "⚡", title: "Gegeneinander", desc: "1-gegen-1-Duell: zwei Charaktere, ein Sieger." },
  { href: "/crew", icon: "🧭", title: "Crew zusammenstellen", desc: "Pro Rolle einen zufälligen Charakter behalten oder neu würfeln, bis die Crew steht." },
  { href: "/fusion", icon: "🧬", title: "Fusions-Pirat", desc: "Teufelsfrucht, Haki, Body, Weapon, Race, Sensei & Mind würfeln — alle Picks auf einen Blick." },
  { href: "/blind-ranking", icon: "🙈", title: "Blind Ranking", desc: "Verdeckte Charaktere nach Thema einordnen, erst danach wird aufgedeckt." },
  { href: "/quiz", icon: "❓", title: "One-Piece-Quiz", desc: "Trivia zu Charakteren, Crews & Teufelsfrüchten — solo oder mit Freunden." },
  { href: "/tierlisten", icon: "📜", title: "Tierlisten", desc: "Charaktere, Arcs, Inseln & mehr in S–D einstufen und vergleichen." },
];
