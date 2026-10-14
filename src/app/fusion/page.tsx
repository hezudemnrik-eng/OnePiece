import { FusionBuilderBoard } from "@/components/FusionBuilderBoard";
import { PageShell } from "@/components/ui/PageShell";

export default function FusionPage() {
  return (
    <PageShell
      title="Fusions-Pirat"
      subtitle="Wähle pro Runde eine von 7 Kategorien — am Ende dein Kopfgeld."
      accent="fusion"
      compact
    >
      <FusionBuilderBoard />
    </PageShell>
  );
}
