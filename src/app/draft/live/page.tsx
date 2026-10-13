import { LiveDraftBoard } from "@/components/LiveDraftBoard";
import { isSupabaseConfigured } from "@/lib/supabase";
import { PageShell } from "@/components/ui/PageShell";

export default function LiveDraftPage() {
  if (!isSupabaseConfigured()) {
    return (
      <PageShell title="Live-Draft über mehrere Geräte" accent="draft">
        <p className="text-sm text-danger">
          Dafür muss Supabase konfiguriert sein (siehe .env.example). Ohne das läuft nur der{" "}
          <a href="/draft" className="underline">
            Hotseat-Draft
          </a>{" "}
          auf einem Gerät.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Live-Draft über mehrere Geräte"
      subtitle="Lobby erstellen und den Code an Freunde schicken, oder mit einem Code beitreten. Jeder draftet von seinem eigenen Gerät."
      accent="draft"
    >
      <LiveDraftBoard />
    </PageShell>
  );
}
