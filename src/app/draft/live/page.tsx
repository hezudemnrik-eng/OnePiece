import { LiveDraftBoard } from "@/components/LiveDraftBoard";
import { isSupabaseConfigured } from "@/lib/supabase";
import { PageShell } from "@/components/ui/PageShell";
import { FitScreen } from "@/components/ui/FitScreen";

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
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-55 dark:opacity-45"
        style={{ backgroundImage: "url(/live-draft/deck-background.jpg)" }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-white/45 dark:bg-black/45" />
      {/* Boss wants the Live-Draft screen to always fit without scrolling,
          same as Home (Q96/zero-scroll follow-up) — see FitScreen/useFitScreen. */}
      <FitScreen>
        <PageShell
          title="Live-Draft über mehrere Geräte"
          subtitle="Lobby erstellen und den Code an Freunde schicken, oder mit einem Code beitreten. Jeder draftet von seinem eigenen Gerät."
          accent="draft"
          compact
        >
          <LiveDraftBoard />
        </PageShell>
      </FitScreen>
    </>
  );
}
