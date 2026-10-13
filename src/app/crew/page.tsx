import { CrewBuilderBoard } from "@/components/CrewBuilderBoard";
import { PageShell } from "@/components/ui/PageShell";

export default function CrewPage() {
  return (
    <PageShell
      title="Crew zusammenstellen"
      subtitle="Für jede Rolle wird dir ein zufälliger Charakter vorgeschlagen — behalte ihn oder würfle neu, bis deine Crew komplett ist."
      accent="crew"
    >
      <CrewBuilderBoard />
    </PageShell>
  );
}
