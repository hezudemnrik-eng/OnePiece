/** Themed loading indicator (a spinning ship's wheel) — used app-wide instead of plain "Lädt…" text. */
export function LoadingSpinner({ label = "Lädt…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-black/50 dark:text-white/40">
      <span className="op-spin inline-block text-lg" aria-hidden>
        🧭
      </span>
      <span>{label}</span>
    </div>
  );
}
