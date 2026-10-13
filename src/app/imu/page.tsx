import { SoloDraftBoard } from "@/components/SoloDraftBoard";

export default function ImuPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl mb-1 text-amber-700 dark:text-amber-400">Gegen Imu</h1>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-rose-500">Imu kann nicht besiegt werden — angeblich.</p>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Draft dein Team aus 5 Charakteren und tritt allein gegen Imu an — kein
        Team, sondern ein einzelner, sehr starker Boss-Gegner. Nur mit dem
        richtigen Build (S/A-Tier-Charaktere, gute Rollenverteilung) hast du
        auf &bdquo;Schwer&ldquo; überhaupt eine Chance, ihn zu verletzen.
      </p>
      <SoloDraftBoard
        opponentName="Imu"
        difficulty="schwer"
        flatBonus={5}
        topShare={0.6}
        storageKey="op-imu-runs"
      />
    </main>
  );
}
