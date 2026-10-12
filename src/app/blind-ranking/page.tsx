import { BlindRankingBoard } from "@/components/BlindRankingBoard";

export default function BlindRankingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1 text-amber-700 dark:text-amber-400">Blind Ranking</h1>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Verdeckte Charaktere nach einem Thema einordnen — erst nach deinem Tipp wird aufgedeckt, wer wer ist.
      </p>
      <BlindRankingBoard />
    </main>
  );
}
