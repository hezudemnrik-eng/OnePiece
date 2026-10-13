import { SoloDraftBoard } from "@/components/SoloDraftBoard";
import { PageShell } from "@/components/ui/PageShell";

export default function ZufallsgegnerPage() {
  return (
    <PageShell
      title="Gegen Zufallsgegner"
      subtitle="Ranked-Modus gegen eine leichtere KI – gute Übung zwischen den Partien gegen Freunde."
      accent="zufallsgegner"
    >
      <SoloDraftBoard opponentName="Zufallsgegner" difficulty="mittel" topShare={0.3} storageKey="op-zufallsgegner-runs" />
    </PageShell>
  );
}
