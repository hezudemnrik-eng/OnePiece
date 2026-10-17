import { TcgBoard } from "@/components/TcgBoard";
import { PageShell } from "@/components/ui/PageShell";

export default function TcgPage() {
  return (
    <PageShell
      title="TCG"
      subtitle="Sammelkarten mit Raritäten bis God Tier. Jeden Tag ein Pack mit 5 Karten."
      accent="tcg"
      maxWidthClassName="max-w-2xl"
    >
      <TcgBoard />
    </PageShell>
  );
}
