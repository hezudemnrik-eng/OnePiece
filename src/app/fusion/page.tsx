import { FusionBuilderBoard } from "@/components/FusionBuilderBoard";

export default function FusionPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1 text-amber-700 dark:text-amber-400">Fusions-Pirat</h1>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Würfle dir Teufelsfrucht, Haki, Body, Weapon, Race, Sensei und Mind von zufälligen Charakteren zusammen — am
        Ende siehst du deinen kompletten Fusions-Piraten auf einen Blick.
      </p>
      <FusionBuilderBoard />
    </main>
  );
}
