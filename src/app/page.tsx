import Link from "next/link";

const links = [
  { href: "/draft", title: "PvP-Draft gegen Freunde", desc: "Snake-Draft im Hotseat, danach Kampfsimulation." },
  { href: "/tierlisten", title: "Tierlisten", desc: "Charaktere in S–D einstufen und vergleichen." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">One Piece Draft-App</h1>
      <p className="text-black/60 dark:text-white/50 mb-8">
        Privates Fan-Projekt – Draft-Spiele und Tierlisten rund um One Piece.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl border border-black/10 dark:border-white/10 p-5 transition hover:border-amber-500 hover:shadow-md"
          >
            <h2 className="font-semibold mb-1">{l.title}</h2>
            <p className="text-sm text-black/60 dark:text-white/50">{l.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
