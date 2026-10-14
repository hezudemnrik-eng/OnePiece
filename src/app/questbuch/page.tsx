import { QuestbuchBoard } from "@/components/QuestbuchBoard";
import { PageShell } from "@/components/ui/PageShell";

export default function QuestbuchPage() {
  return (
    <PageShell title="Questbuch" subtitle="Deine tägliche Herausforderung — jeden Tag eine neue." maxWidthClassName="max-w-2xl">
      <QuestbuchBoard />
    </PageShell>
  );
}
