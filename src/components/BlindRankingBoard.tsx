"use client";

import { useState } from "react";
import { BLIND_THEMES, buildRound, correctOrder, scoreGuess, type BlindEntry, type BlindScore } from "@/lib/blindRanking";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import { useAnimationsEnabled } from "@/lib/animPrefs";

type Phase = "setup" | "guessing" | "result";

const ROUND_SIZES = [5, 6, 8];
const HISTORY_KEY = "op-blind-ranking-history";

type HistoryRecord = { date: string; theme: string; correctPositions: number; total: number };

function loadHistory(): HistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(record: HistoryRecord) {
  try {
    const next = [record, ...loadHistory()].slice(0, 20);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function BlindRankingBoard() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [themeId, setThemeId] = useState(BLIND_THEMES[0].id);
  const [size, setSize] = useState(6);
  const [round, setRound] = useState<BlindEntry[]>([]);
  const [shuffledForDisplay, setShuffledForDisplay] = useState<BlindEntry[]>([]);
  const [guessOrder, setGuessOrder] = useState<string[]>([]);
  const [score, setScore] = useState<BlindScore | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());
  const [animationsEnabled] = useAnimationsEnabled();

  const theme = BLIND_THEMES.find((t) => t.id === themeId) ?? BLIND_THEMES[0];

  function startRound(nextThemeId = themeId) {
    const r = buildRound(nextThemeId, size);
    setRound(r);
    setShuffledForDisplay([...r].sort(() => Math.random() - 0.5));
    setGuessOrder([]);
    setScore(null);
    setPhase("guessing");
  }

  function toggleSlot(slotId: string) {
    if (guessOrder.includes(slotId)) {
      setGuessOrder(guessOrder.filter((id) => id !== slotId));
      return;
    }
    if (guessOrder.length >= round.length) return;
    const next = [...guessOrder, slotId];
    setGuessOrder(next);
    if (animationsEnabled) vibrate(15);
  }

  function reveal() {
    if (guessOrder.length !== round.length) return;
    const result = scoreGuess(round, guessOrder);
    setScore(result);
    if (animationsEnabled) {
      if (result.correctPositions >= Math.ceil(round.length * 0.6)) playAccept();
      else playSkip();
    }
    saveHistory({
      date: new Date().toLocaleString("de-DE"),
      theme: theme.label,
      correctPositions: result.correctPositions,
      total: result.total,
    });
    setHistory(loadHistory());
    setPhase("result");
  }

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-4 max-w-lg">
        <label className="flex flex-col gap-1 text-sm">
          Thema
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          >
            {BLIND_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-black/50 dark:text-white/40">{theme.description}</span>
        </label>
        <div className="flex flex-col gap-1 text-sm">
          Runden-Größe
          <div className="flex gap-2">
            {ROUND_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`rounded-md border px-3 py-1.5 text-sm ${size === s ? "border-amber-500 bg-amber-500/10 font-semibold" : "border-black/15 dark:border-white/15"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => startRound()}
          className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
        >
          Blind Ranking starten
        </button>
        {history.length > 0 && (
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm">
            <p className="mb-2 font-medium">Letzte Runden</p>
            <ul className="space-y-0.5 text-xs text-black/60 dark:text-white/50">
              {history.slice(0, 5).map((h, i) => (
                <li key={i}>
                  {h.date} – {h.theme}: {h.correctPositions}/{h.total} richtig platziert
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (phase === "guessing") {
    return (
      <div className="flex flex-col gap-5 max-w-2xl">
        <div>
          <h2 className="text-lg font-semibold">{theme.label}</h2>
          <p className="text-sm text-black/60 dark:text-white/50">
            Tippe die Charaktere in absteigender Reihenfolge an (1. Klick = stärkster). Noch keine Namen oder Werte sichtbar.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {shuffledForDisplay.map((entry) => {
            const rank = guessOrder.indexOf(entry.slotId);
            return (
              <button
                key={entry.slotId}
                onClick={() => toggleSlot(entry.slotId)}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border p-4 h-28 transition ${
                  rank >= 0
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-black/15 dark:border-white/15 hover:border-amber-500/50"
                }`}
              >
                {rank >= 0 && (
                  <span className="absolute -top-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-white text-sm font-bold">
                    {rank + 1}
                  </span>
                )}
                <span className="text-3xl" aria-hidden>
                  🏴‍☠️
                </span>
                <span className="text-xs text-black/50 dark:text-white/40">Mysteriöser Charakter</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reveal}
            disabled={guessOrder.length !== round.length}
            className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700 disabled:opacity-40"
          >
            Aufdecken ({guessOrder.length}/{round.length})
          </button>
          <button onClick={() => setGuessOrder([])} className="text-sm text-black/50 dark:text-white/40 hover:underline">
            Zurücksetzen
          </button>
        </div>
      </div>
    );
  }

  if (phase === "result" && score) {
    const truth = correctOrder(round);
    const guessed = guessOrder.map((id) => round.find((e) => e.slotId === id)!);
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <h2 className="text-xl font-semibold">
          {score.correctPositions} / {score.total} richtig platziert
        </h2>
        <ol className="flex flex-col gap-2">
          {guessed.map((entry, i) => {
            const trueIndex = truth.findIndex((e) => e.slotId === entry.slotId);
            const correct = trueIndex === i;
            return (
              <li
                key={entry.slotId}
                className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${correct ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5"}`}
              >
                <span className="w-6 text-center font-bold">{i + 1}.</span>
                {entry.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.imageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-full object-cover object-top border border-black/10 dark:border-white/10"
                  />
                ) : (
                  <span className="h-10 w-10 rounded-full bg-amber-500/15" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{entry.name}</p>
                  <p className="text-xs text-black/60 dark:text-white/50">{entry.valueLabel}</p>
                </div>
                {!correct && <span className="text-xs text-black/50 dark:text-white/40">eigtl. Platz {trueIndex + 1}</span>}
              </li>
            );
          })}
        </ol>
        <div className="flex gap-3">
          <button
            onClick={() => startRound()}
            className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
          >
            Nochmal (gleiches Thema)
          </button>
          <button
            onClick={() => setPhase("setup")}
            className="rounded-md border border-black/15 dark:border-white/15 px-4 py-2 font-medium"
          >
            Anderes Thema
          </button>
        </div>
      </div>
    );
  }

  return null;
}
