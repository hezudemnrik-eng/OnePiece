import { LiveDraftBoard } from "@/components/LiveDraftBoard";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function LiveDraftPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">Live-Draft über mehrere Geräte</h1>
        <p className="text-sm text-amber-600">
          Dafür muss Supabase konfiguriert sein (siehe .env.example). Ohne das läuft nur der{" "}
          <a href="/draft" className="underline">
            Hotseat-Draft
          </a>{" "}
          auf einem Gerät.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Live-Draft über mehrere Geräte</h1>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Lobby erstellen und den Code an Freunde schicken, oder mit einem Code beitreten. Jeder draftet von seinem eigenen Gerät.
      </p>
      <LiveDraftBoard />
    </main>
  );
}
