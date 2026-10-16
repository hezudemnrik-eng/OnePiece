import { FusionBuilderBoard } from "@/components/FusionBuilderBoard";
import { PageShell } from "@/components/ui/PageShell";
import { FitScreen } from "@/components/ui/FitScreen";

export default function FusionPage() {
  return (
    // Zero-Scroll-Fit wie Home/Live-Draft (siehe FitScreen/useFitScreen):
    // ohne das ragte der "Neuen Fusions-Piraten würfeln"-Button auf kleineren
    // Screens unter die Navi-Leiste bzw. unter den sichtbaren Bereich, weil
    // die 7-Kategorien-Ergebnisansicht ungebremst in die Höhe wuchs statt
    // sich dem verfügbaren Platz zwischen Header und Navi-Leiste anzupassen.
    <FitScreen>
      <PageShell
        title="Fusions-Pirat"
        subtitle="Wähle pro Runde eine von 7 Kategorien — am Ende dein Kopfgeld."
        accent="fusion"
        compact
      >
        <FusionBuilderBoard />
      </PageShell>
    </FitScreen>
  );
}
