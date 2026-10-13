import { CategoryHub } from "@/components/CategoryHub";
import { PageShell } from "@/components/ui/PageShell";

export default function RaetselRankingPage() {
  return (
    <PageShell title="Rätsel & Ranking" subtitle="Quiz, Tierlisten & Blind Ranking." accent="quiz">
      <CategoryHub group="raetsel-ranking" />
    </PageShell>
  );
}
