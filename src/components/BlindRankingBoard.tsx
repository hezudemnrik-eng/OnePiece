"use client";

import { useState } from "react";
import { BLIND_THEMES, buildRound, correctOrder, scoreGuess, type BlindEntry, type BlindScore } from "@/lib/blindRanking";
import { checkBlindRankingAchievements, type BlindRankingAchievement } from "@/lib/blindRankingAchievements";
import { XP_ACHIEVEMENT_BONUS, XP_BLIND_RANKING_COMPLETE } from "@/lib/levels";
import { playAccept, playSkip, playTick, vibrate } from "@/lib/sfx";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { incrementXp, recordBlindRankingCompletion, unlockAchievement } from "@/lib/supabase";

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
  const [presentOrder, setPresentOrder] = useState<BlindEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // assignments[rank] = slotId of the entry the player placed at that rank (rank 0 = stärkster)
  const [assignments, setAssignments] = useState<(string | null)[]>([]);
  const [score, setScore] = useState<BlindScore | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());
  const [newAchievements, setNewAchievements] = useState<BlindRankingAchievement[]>([]);
  const [animationsEnabled] = useAnimationsEnabled();

  const theme = BLIND_THEMES.find((t) => t.id === themeId) ?? BLIND_THEMES[0];

  function startRound(nextThemeId = themeId) {
    const r = buildRound(nextThemeId, size);
    setRound(r);
    setPresentOrder([...r].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setAssignments(new Array(r.length).fill(null));
    setScore(null);
    setNewAchievements([]);
    setPhase("guessing");
  }

  async function finalizeRound(result: BlindScore) {
    const earned = checkBlindRankingAchievements(result);
    if (earned.length === 0) return;
    const results = await Promise.all(earned.map(async (a) => ({ a, isNew: await unlockAchievement(a.id) })));
    const fresh = results.filter((r) => r.isNew).map((r) => r.a);
    if (fresh.length > 0) {
      incrementXp(fresh.length * XP_ACHIEVEMENT_BONUS);
      setNewAchievements(fresh);
    }
  }

  function finish(finalAssignments: (string | null)[]) {
    const guessOrder = finalAssignments as string[];
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
    recordBlindRankingCompletion(XP_BLIND_RANKING_COMPLETE);
    finalizeRound(result);
  }

  function assignRank(rank: number) {
    if (assignments[rank] !== null) return;
    const current = presentOrder[currentIndex];
    if (!current) return;
    const next = [...assignments];
    next[rank] = current.slotId;
    setAssignments(next);
    if (animationsEnabled) {
      playTick();
      vibrate(15);
    }
    if (currentIndex + 1 >= presentOrder.length) {
      finish(next);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function restartSameRound() {
    setCurrentIndex(0);
    setAssignments(new Array(round.length).fill(null));
    setScore(null);
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
    const current = presentOrder[currentIndex];
    return (
      <div className="flex flex-col gap-5 max-w-lg">
        <div>
          <h2 className="text-lg font-semibold">{theme.label}</h2>
          <p className="text-sm text-black/60 dark:text-white/50">
            Charakter {currentIndex + 1} von {presentOrder.length} — wähle, auf welchem Rang er steht (Platz 1 = stärkster).
            Erst danach siehst du den nächsten Charakter.
          </p>
        </div>
        {current && (
          <div className="op-parchment flex flex-col items-center gap-3 rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent p-6">
            {current.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.imageUrl}
                alt={current.name}
                referrerPolicy="no-referrer"
                className="h-32 w-auto rounded-lg border border-amber-500/40 object-cover object-top shadow-lg"
              />
            ) : (
              <span className="flex h-32 w-24 items-center justify-center rounded-lg bg-amber-500/15 text-3xl font-bold text-amber-700 dark:text-amber-400">
                {current.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <p className="text-center text-lg font-semibold">{current.name}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {assignments.map((slotId, rank) => {
            const occupant = slotId ? round.find((e) => e.slotId === slotId) : null;
            return (
              <button
                key={rank}
                onClick={() => assignRank(rank)}
                disabled={Boolean(occupant)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-sm text-left transition ${
                  occupant
                    ? "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5"
                    : "border-amber-500/40 hover:bg-amber-500/10"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-white text-sm font-bold shrink-0">
                  {rank + 1}
                </span>
                {occupant ? (
                  <span className="font-medium">{occupant.name}</span>
                ) : (
                  <span className="text-black/50 dark:text-white/40">— frei: hier einordnen —</span>
                )}
              </button>
            );
          })}
        </div>
        <button onClick={restartSameRound} className="self-start text-sm text-black/50 dark:text-white/40 hover:underline">
          Zurücksetzen
        </button>
      </div>
    );
  }

  if (phase === "result" && score) {
    const truth = correctOrder(round);
    const guessed = assignments.map((id) => round.find((e) => e.slotId === id)!);
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <h2 className="text-xl font-semibold">
          {score.correctPositions} / {score.total} richtig platziert
        </h2>
        {newAchievements.length > 0 && (
          <div className="op-pop-in rounded-xl border border-accent bg-accent/10 p-3">
            <p className="mb-1 text-sm font-semibold text-accent">🏆 Neue Erfolge freigeschaltet!</p>
            <ul className="flex flex-col gap-0.5 text-xs text-black/70 dark:text-white/60">
              {newAchievements.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.label}</span> — {a.description}
                </li>
              ))}
            </ul>
          </div>
        )}
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
