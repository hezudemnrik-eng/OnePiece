"use client";

import { useState } from "react";
import { getCrews } from "@/lib/characters";
import {
  BLIND_STAT_LABELS,
  BLIND_THEMES,
  buildRound,
  correctOrder,
  createCustomBlindTheme,
  loadCustomBlindThemes,
  randomThemeId,
  saveCustomBlindThemes,
  scoreGuess,
  type BlindEntry,
  type BlindScore,
  type BlindStatKey,
  type CustomBlindTheme,
} from "@/lib/blindRanking";
import { checkBlindRankingAchievements, type BlindRankingAchievement } from "@/lib/blindRankingAchievements";
import { XP_ACHIEVEMENT_BONUS, XP_BLIND_RANKING_COMPLETE } from "@/lib/levels";
import { playAccept, playSkip, playTick, vibrate } from "@/lib/sfx";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { incrementXp, recordBlindRankingCompletion, unlockAchievement } from "@/lib/supabase";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";

type Phase = "setup" | "guessing" | "result";

const RANDOM_THEME_ID = "__random__";
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
  const [themeChoice, setThemeChoice] = useState<string>(BLIND_THEMES[0].id);
  const [customThemes, setCustomThemes] = useState<CustomBlindTheme[]>(() => loadCustomBlindThemes());
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customStat, setCustomStat] = useState<BlindStatKey>("gesamtkampfkraft");
  const [customCrew, setCustomCrew] = useState<string>("");
  const [size, setSize] = useState(6);
  const [activeThemeLabel, setActiveThemeLabel] = useState(BLIND_THEMES[0].label);
  const [round, setRound] = useState<BlindEntry[]>([]);
  const [presentOrder, setPresentOrder] = useState<BlindEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // assignments[rank] = slotId of the entry the player placed at that rank (rank 0 = stärkster)
  const [assignments, setAssignments] = useState<(string | null)[]>([]);
  const [score, setScore] = useState<BlindScore | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());
  const [newAchievements, setNewAchievements] = useState<BlindRankingAchievement[]>([]);
  const [animationsEnabled] = useAnimationsEnabled();

  const allThemes = [...BLIND_THEMES, ...customThemes];

  function addCustomTheme() {
    if (!customLabel.trim()) return;
    const theme = createCustomBlindTheme(customLabel, customStat, customCrew || null);
    const next = [...customThemes, theme];
    setCustomThemes(next);
    saveCustomBlindThemes(next);
    setThemeChoice(theme.id);
    setCustomLabel("");
    setShowCustomForm(false);
  }

  function startRound() {
    const resolvedId = themeChoice === RANDOM_THEME_ID ? randomThemeId(customThemes) : themeChoice;
    const resolvedTheme = allThemes.find((t) => t.id === resolvedId) ?? BLIND_THEMES[0];
    setActiveThemeLabel(resolvedTheme.label);
    const r = buildRound(resolvedTheme.id, size, Math.random, customThemes);
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
      theme: activeThemeLabel,
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
          <Select value={themeChoice} onChange={(e) => setThemeChoice(e.target.value)}>
            <option value={RANDOM_THEME_ID}>🎲 Zufällige Kategorie</option>
            <optgroup label="Vorlagen">
              {BLIND_THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            {customThemes.length > 0 && (
              <optgroup label="Eigene Themen">
                {customThemes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
          {themeChoice !== RANDOM_THEME_ID && (
            <span className="text-xs text-black/50 dark:text-white/40">
              {allThemes.find((t) => t.id === themeChoice)?.description}
            </span>
          )}
        </label>

        <button
          type="button"
          onClick={() => setShowCustomForm((v) => !v)}
          className="self-start text-xs text-black/50 dark:text-white/40 hover:text-mode-blind-ranking hover:underline"
        >
          {showCustomForm ? "Abbrechen" : "+ Eigenes Thema erstellen"}
        </button>

        {showCustomForm && (
          <Card variant="plain" className="flex flex-col gap-2 p-3">
            <Input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Name des Themas"
            />
            <Select value={customStat} onChange={(e) => setCustomStat(e.target.value as BlindStatKey)}>
              {Object.entries(BLIND_STAT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
            <Select value={customCrew} onChange={(e) => setCustomCrew(e.target.value)}>
              <option value="">Alle Crews</option>
              {getCrews().map((crew) => (
                <option key={crew} value={crew}>
                  {crew}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={addCustomTheme} disabled={!customLabel.trim()}>
              Thema speichern
            </Button>
          </Card>
        )}

        <div className="flex flex-col gap-1 text-sm">
          Runden-Größe
          <div className="flex gap-2">
            {ROUND_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`rounded-md border px-3 py-1.5 text-sm ${size === s ? "border-mode-blind-ranking bg-mode-blind-ranking/10 font-semibold" : "border-black/15 dark:border-white/15"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={startRound}>Blind Ranking starten</Button>
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
          <h2 className="text-lg font-semibold">{activeThemeLabel}</h2>
          <p className="text-sm text-black/60 dark:text-white/50">
            Charakter {currentIndex + 1} von {presentOrder.length} — wähle, auf welchem Rang er steht (Platz 1 = stärkster).
            Erst danach siehst du den nächsten Charakter.
          </p>
        </div>
        {current && (
          <div className="op-wanted op-parchment flex flex-col items-center gap-3 rounded-xl p-4">
            {current.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.imageUrl}
                alt={current.name}
                referrerPolicy="no-referrer"
                className="h-32 w-auto rounded-lg border-2 border-poster-ink object-cover object-top"
              />
            ) : (
              <span className="flex h-32 w-24 items-center justify-center rounded-lg border-2 border-poster-ink bg-mode-blind-ranking/15 text-3xl font-bold">
                {current.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <p className="font-[family-name:var(--font-display)] text-center text-lg">{current.name}</p>
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
                    : "border-mode-blind-ranking/40 hover:bg-mode-blind-ranking/10"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mode-blind-ranking text-white text-sm font-bold shrink-0">
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
          <div className="op-pop-in rounded-xl border border-mode-blind-ranking bg-mode-blind-ranking/10 p-3">
            <p className="mb-1 text-sm font-semibold text-mode-blind-ranking">🏆 Neue Erfolge freigeschaltet!</p>
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
                className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${correct ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5"}`}
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
                  <span className="h-10 w-10 rounded-full bg-mode-blind-ranking/15" />
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
          <Button onClick={startRound}>Nochmal</Button>
          <Button variant="secondary" onClick={() => setPhase("setup")}>
            Anderes Thema
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
