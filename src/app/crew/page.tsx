import { CrewBuilderBoard } from "@/components/CrewBuilderBoard";

export default function CrewPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1 text-amber-700 dark:text-amber-400">Crew zusammenstellen</h1>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Für jede Rolle wird dir ein zufälliger Charakter vorgeschlagen — behalte ihn oder würfle neu, bis deine Crew komplett ist.
      </p>
      <CrewBuilderBoard />
    </main>
  );
}
