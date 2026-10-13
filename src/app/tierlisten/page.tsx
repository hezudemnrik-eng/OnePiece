import { TierListEditor } from "@/components/TierListEditor";
import { PageShell } from "@/components/ui/PageShell";

export default function TierlistenPage() {
  return (
    <PageShell
      title="Tierlisten"
      subtitle="Ziehe Charaktere in die S–D-Reihen und vergleiche deine Einstufung mit einer anderen gespeicherten Liste."
      accent="tierlisten"
    >
      <TierListEditor />
    </PageShell>
  );
}
