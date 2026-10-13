import { ShopBoard } from "@/components/ShopBoard";
import { PageShell } from "@/components/ui/PageShell";

export default function ShopPage() {
  return (
    <PageShell
      title="Shop"
      subtitle="Kosmetische Rahmen, Farben, Avatare, Titel und Duell-Arenen, käuflich mit Berry."
      accent="shop"
      maxWidthClassName="max-w-2xl"
    >
      <ShopBoard />
    </PageShell>
  );
}
