import { DuelBoard } from "@/components/DuelBoard";

export default function DuellPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1 text-amber-700 dark:text-amber-400">Gegeneinander</h1>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Zwei Charaktere treten 1-gegen-1 an — zufällig oder von dir gewählt. Kurze Kampfsimulation, dann steht der Sieger fest.
      </p>
      <DuelBoard />
    </main>
  );
}
