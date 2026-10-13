import { DuelBoard } from "@/components/DuelBoard";
import { PageShell } from "@/components/ui/PageShell";

export default function DuellPage() {
  return (
    <PageShell
      title="Gegeneinander"
      subtitle="Charaktere treten gegeneinander an — 1 gegen 1 oder im Team-Duell zu dritt, zufällig oder von dir gewählt. Kurze Kampfsimulation, dann steht der Sieger fest."
      accent="duell"
    >
      <DuelBoard />
    </PageShell>
  );
}
