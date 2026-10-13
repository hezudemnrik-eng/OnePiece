import { FusionBuilderBoard } from "@/components/FusionBuilderBoard";
import { PageShell } from "@/components/ui/PageShell";

export default function FusionPage() {
  return (
    <PageShell
      title="Fusions-Pirat"
      subtitle="Würfle dir Teufelsfrucht, Haki, Body, Weapon, Race, Sensei und Mind von zufälligen Charakteren zusammen — am Ende bekommst du ein Kopfgeld für deinen Fusions-Piraten."
      accent="fusion"
    >
      <FusionBuilderBoard />
    </PageShell>
  );
}
