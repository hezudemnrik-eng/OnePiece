import Link from "next/link";

// Rendering here depends on AuthGate's client-side auth check in the root
// layout, so this route can't produce a static instant-navigation shell.
export const instant = false;

const links = [
  { href: "/draft", icon: "⚔️", title: "PvP-Draft gegen Freunde", desc: "Snake-Draft im Hotseat, danach Kampfsimulation." },
  { href: "/draft/live", icon: "🌐", title: "Live-Draft (mehrere Geräte)", desc: "Lobby mit Code teilen, jeder draftet von seinem Gerät." },
  { href: "/imu", icon: "👁️", title: "Gegen Imu", desc: "Solo-Draft gegen eine starke KI-Auswahl." },
  { href: "/zufallsgegner", icon: "🎲", title: "Gegen Zufallsgegner", desc: "Ranked-Übungsrunde gegen eine leichtere KI." },
  { href: "/tierlisten", icon: "📜", title: "Tierlisten", desc: "Charaktere, Arcs, Inseln & mehr in S–D einstufen und vergleichen." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-12 text-center">
        <p className="mb-2 text-sm uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">
          Privates Fan-Projekt
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl text-amber-700 dark:text-amber-400 mb-3">
          One Piece Draft-App
        </h1>
        <p className="text-black/60 dark:text-white/50 max-w-lg mx-auto">
          Draft-Spiele, KI-Gegner und Tierlisten rund um One Piece – gebaut für den Freundeskreis.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group rounded-xl border border-black/10 dark:border-white/10 bg-[var(--surface)]/60 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-500 hover:shadow-lg"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                {l.icon}
              </span>
              <h2 className="font-semibold group-hover:text-amber-600 dark:group-hover:text-amber-400">
                {l.title}
              </h2>
            </div>
            <p className="text-sm text-black/60 dark:text-white/50">{l.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
