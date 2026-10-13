import { TierListEditor } from "@/components/TierListEditor";

export default function TierlistenPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl mb-1 text-amber-700 dark:text-amber-400">Tierlisten</h1>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Ziehe Charaktere in die S–D-Reihen und vergleiche deine Einstufung mit
        einer anderen gespeicherten Liste.
      </p>
      <TierListEditor />
    </main>
  );
}
