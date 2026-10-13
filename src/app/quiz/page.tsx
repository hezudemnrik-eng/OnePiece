"use client";

import { useState } from "react";
import { QuizSoloBoard } from "@/components/QuizSoloBoard";
import { QuizLiveBoard } from "@/components/QuizLiveBoard";
import { isSupabaseConfigured } from "@/lib/supabase";
import { PageShell } from "@/components/ui/PageShell";

export default function QuizPage() {
  const [mode, setMode] = useState<"solo" | "live">("solo");

  return (
    <PageShell
      title="One-Piece-Quiz"
      subtitle="Fragen zu Charakteren, Crews, Teufelsfrüchten und Arcs — allein üben oder mit einem Code gegen Freunde."
      accent="quiz"
    >
      {isSupabaseConfigured() && (
        <div className="mb-6 flex gap-2 rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm w-fit">
          <button
            onClick={() => setMode("solo")}
            className={`rounded-md px-3 py-1.5 font-medium ${mode === "solo" ? "bg-mode-quiz text-white" : "text-black/60 dark:text-white/50"}`}
          >
            Solo
          </button>
          <button
            onClick={() => setMode("live")}
            className={`rounded-md px-3 py-1.5 font-medium ${mode === "live" ? "bg-mode-quiz text-white" : "text-black/60 dark:text-white/50"}`}
          >
            Mit Freunden
          </button>
        </div>
      )}
      {mode === "solo" ? <QuizSoloBoard /> : <QuizLiveBoard />}
    </PageShell>
  );
}
