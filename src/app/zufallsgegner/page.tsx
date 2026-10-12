import { SoloDraftBoard } from "@/components/SoloDraftBoard";

export default function ZufallsgegnerPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Gegen Zufallsgegner</h1>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Ranked-Modus gegen eine leichtere KI – gute Übung zwischen den
        Partien gegen Freunde.
      </p>
      <SoloDraftBoard
        opponentName="Zufallsgegner"
        difficulty="mittel"
        topShare={0.3}
        storageKey="op-zufallsgegner-runs"
      />
    </main>
  );
}
