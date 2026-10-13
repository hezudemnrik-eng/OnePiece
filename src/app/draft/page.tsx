import { DraftBoard } from "@/components/DraftBoard";
import { PageShell } from "@/components/ui/PageShell";

export default function DraftPage() {
  return (
    <PageShell
      title="PvP-Draft gegen Freunde"
      subtitle="Hotseat-Modus auf einem Gerät für den Start. Live-Draft über mehrere Geräte braucht noch die Supabase-Anbindung (siehe .env.example)."
      accent="draft"
    >
      <DraftBoard />
    </PageShell>
  );
}
