import { BlindRankingBoard } from "@/components/BlindRankingBoard";

export default function BlindRankingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl mb-1 text-amber-700 dark:text-amber-400">Blind Ranking</h1>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Du bekommst nach und nach einen Charakter genannt und musst ihn direkt auf einen Rang setzen — den nächsten
        Charakter siehst du erst danach. Die echten Werte werden erst am Ende aufgedeckt.
      </p>
      <BlindRankingBoard />
    </main>
  );
}
