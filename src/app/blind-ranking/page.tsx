import { BlindRankingBoard } from "@/components/BlindRankingBoard";
import { PageShell } from "@/components/ui/PageShell";

export default function BlindRankingPage() {
  return (
    <PageShell
      title="Blind Ranking"
      subtitle="Du bekommst nach und nach einen Charakter genannt und musst ihn direkt auf einen Rang setzen — den nächsten Charakter siehst du erst danach. Die echten Werte werden erst am Ende aufgedeckt."
      accent="blind-ranking"
    >
      <BlindRankingBoard />
    </PageShell>
  );
}
