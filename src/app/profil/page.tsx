import { ProfileBoard } from "@/components/ProfileBoard";

export default function ProfilPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl mb-1 text-amber-700 dark:text-amber-400">
        Profil
      </h1>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Dein Rang, Level-Fortschritt, freigeschaltete Profil-Rahmen und Fusions-Pirat-Erfolge.
      </p>
      <ProfileBoard />
    </main>
  );
}
