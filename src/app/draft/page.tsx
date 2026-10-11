import { DraftBoard } from "@/components/DraftBoard";

export default function DraftPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">PvP-Draft gegen Freunde</h1>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Hotseat-Modus auf einem Gerät für den Start. Live-Draft über mehrere
        Geräte braucht noch die Supabase-Anbindung (siehe .env.example).
      </p>
      <DraftBoard />
    </main>
  );
}
