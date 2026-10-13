import type { MatchMode } from "./supabase";
import type { ModeAccent } from "@/components/ui/modeAccents";

export type ModeGroupId = "kampf" | "raetsel-ranking" | "builder";

export type GameMode = {
  href: string;
  icon: string;
  title: string;
  desc: string;
  matchMode?: MatchMode;
  group: ModeGroupId;
  accent: ModeAccent;
  /** Within the "kampf" group, Solo vs. Live stay visually separate (Q54). */
  live?: boolean;
};

/** The 3-category navigation (Q52/Q53) that the bottom nav / icon rail route into. */
export const MODE_GROUPS: { id: ModeGroupId; href: string; icon: string; title: string }[] = [
  { id: "kampf", href: "/kampf", icon: "⚔️", title: "Kampf" },
  { id: "raetsel-ranking", href: "/raetsel-ranking", icon: "❓", title: "Rätsel & Ranking" },
  { id: "builder", href: "/builder", icon: "🧭", title: "Builder" },
];

/**
 * The Berry-shop's own tile (not a MODE_GROUP — it has no sub-pages to
 * route a hub into, just its own standalone page), shown alongside the 3
 * mode groups on Home and in the desktop icon rail.
 */
export const SHOP_TILE = { href: "/shop", icon: "🛒", title: "Shop" };

/** Every game mode's nav entry — shared by the category hub pages and (formerly) the sidebar. */
export const MODES: GameMode[] = [
  {
    href: "/draft",
    icon: "⚔️",
    title: "PvP-Draft gegen Freunde",
    desc: "Snake-Draft im Hotseat, danach Kampfsimulation.",
    group: "kampf",
    accent: "draft",
  },
  {
    href: "/draft/live",
    icon: "🌐",
    title: "Live-Draft (mehrere Geräte)",
    desc: "Lobby mit Code teilen, jeder draftet von seinem Gerät.",
    matchMode: "live-draft",
    group: "kampf",
    accent: "draft",
    live: true,
  },
  {
    href: "/imu",
    icon: "👁️",
    title: "Gegen Imu",
    desc: "Solo-Draft gegen einen übermächtigen Boss-Gegner.",
    matchMode: "imu",
    group: "kampf",
    accent: "imu",
  },
  {
    href: "/zufallsgegner",
    icon: "🎲",
    title: "Gegen Zufallsgegner",
    desc: "Ranked-Übungsrunde gegen eine leichtere KI.",
    matchMode: "zufallsgegner",
    group: "kampf",
    accent: "zufallsgegner",
  },
  {
    href: "/duell",
    icon: "⚡",
    title: "Gegeneinander",
    desc: "1-gegen-1-Duell: zwei Charaktere, ein Sieger.",
    group: "kampf",
    accent: "duell",
  },
  {
    href: "/crew",
    icon: "🧭",
    title: "Crew zusammenstellen",
    desc: "Pro Rolle einen zufälligen Charakter behalten oder neu würfeln, bis die Crew steht.",
    group: "builder",
    accent: "crew",
  },
  {
    href: "/fusion",
    icon: "🧬",
    title: "Fusions-Pirat",
    desc: "Teufelsfrucht, Haki, Body, Weapon, Race, Sensei & Mind würfeln — alle Picks auf einen Blick.",
    group: "builder",
    accent: "fusion",
  },
  {
    href: "/blind-ranking",
    icon: "🙈",
    title: "Blind Ranking",
    desc: "Verdeckte Charaktere nach Thema einordnen, erst danach wird aufgedeckt.",
    group: "raetsel-ranking",
    accent: "blind-ranking",
  },
  {
    href: "/quiz",
    icon: "❓",
    title: "One-Piece-Quiz",
    desc: "Trivia zu Charakteren, Crews & Teufelsfrüchten — solo oder mit Freunden.",
    group: "raetsel-ranking",
    accent: "quiz",
  },
  {
    href: "/tierlisten",
    icon: "📜",
    title: "Tierlisten",
    desc: "Charaktere, Arcs, Inseln & mehr in S–D einstufen und vergleichen.",
    group: "raetsel-ranking",
    accent: "tierlisten",
  },
];
