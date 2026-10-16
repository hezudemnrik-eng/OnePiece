import { CategoryHub } from "@/components/CategoryHub";
import { PageShell } from "@/components/ui/PageShell";

export default function KampfPage() {
  return (
    <PageShell title="Kampf" subtitle="Solo gegen Imu oder live mit Freunden." accent="duell" fit>
      <CategoryHub group="kampf" splitSoloLive />
    </PageShell>
  );
}
