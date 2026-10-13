"use client";

import { useState } from "react";
import { QuizSoloBoard } from "@/components/QuizSoloBoard";
import { QuizLiveBoard } from "@/components/QuizLiveBoard";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function QuizPage() {
  const [mode, setMode] = useState<"solo" | "live">("solo");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl mb-1 text-amber-700 dark:text-amber-400">One-Piece-Quiz</h1>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Fragen zu Charakteren, Crews, Teufelsfrüchten und Arcs — allein üben oder mit einem Code gegen Freunde.
      </p>
      {isSupabaseConfigured() && (
        <div className="mb-6 flex gap-2 rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm w-fit">
          <button
            onClick={() => setMode("solo")}
            className={`rounded-md px-3 py-1.5 font-medium ${mode === "solo" ? "bg-amber-600 text-white" : "text-black/60 dark:text-white/50"}`}
          >
            Solo
          </button>
          <button
            onClick={() => setMode("live")}
            className={`rounded-md px-3 py-1.5 font-medium ${mode === "live" ? "bg-amber-600 text-white" : "text-black/60 dark:text-white/50"}`}
          >
            Mit Freunden
          </button>
        </div>
      )}
      {mode === "solo" ? <QuizSoloBoard /> : <QuizLiveBoard />}
    </main>
  );
}
