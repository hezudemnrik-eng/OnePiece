"use client";

import { useState } from "react";
import { FUSION_CATEGORIES, computeBounty, formatBerry, rollFusionOption, type FusionOption } from "@/lib/fusionTraits";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";

type Phase = "setup" | "rolling" | "done";

const HISTORY_KEY = "op-fusion-history";

type HistoryRecord = { date: string; bounty: number };

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

export function FusionBuilderBoard() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [candidate, setCandidate] = useState<FusionOption | null>(null);
  const [picks, setPicks] = useState<FusionOption[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());

  const category = FUSION_CATEGORIES[categoryIndex];

  function reroll() {
    playSkip();
    vibrate(15);
    setCandidate(rollFusionOption(category.id));
  }

  function keep() {
    if (!candidate) return;
    playAccept();
    vibrate(25);
    const next = [...picks, candidate];
    setPicks(next);
    if (categoryIndex + 1 < FUSION_CATEGORIES.length) {
      setCategoryIndex(categoryIndex + 1);
      setCandidate(rollFusionOption(FUSION_CATEGORIES[categoryIndex + 1].id));
    } else {
      const bounty = computeBounty(next);
      saveHistory({ date: new Date().toLocaleString("de-DE"), bounty });
      setHistory(loadHistory());
      setPhase("done");
    }
  }

  function start() {
    setPhase("rolling");
    setCategoryIndex(0);
    setPicks([]);
    setCandidate(rollFusionOption(FUSION_CATEGORIES[0].id));
  }

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <p className="text-sm text-black/60 dark:text-white/50">
          Für jede der {FUSION_CATEGORIES.length} Kategorien (
          {FUSION_CATEGORIES.map((c) => c.label).join(", ")}) bekommst du einen zufälligen Charakter vorgeschlagen.
          Behalte seine Eigenschaft oder würfle neu — am Ende verschmelzen alle Picks zu einem Kopfgeld.
        </p>
        <button
          onClick={start}
          className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
        >
          Fusion starten
        </button>
        {history.length > 0 && (
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm">
            <p className="mb-2 font-medium">Frühere Kopfgelder</p>
            <ul className="space-y-0.5 text-xs text-black/60 dark:text-white/50">
              {history.slice(0, 5).map((h, i) => (
                <li key={i}>
                  {h.date} – {formatBerry(h.bounty)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (phase === "rolling") {
    return (
      <div className="flex flex-col gap-6 max-w-xl">
        <div className="text-sm text-black/50 dark:text-white/40">
          Kategorie {categoryIndex + 1} / {FUSION_CATEGORIES.length}
        </div>
        <h2 className="text-xl font-semibold">{category.label}</h2>
        {candidate && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent p-6">
            {candidate.sourceImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={candidate.sourceImageUrl}
                alt={candidate.sourceName}
                referrerPolicy="no-referrer"
                className="h-32 w-auto rounded-lg border border-amber-500/40 object-cover object-top shadow-lg"
              />
            ) : (
              <span className="flex h-32 w-24 items-center justify-center rounded-lg bg-amber-500/15 text-3xl font-bold text-amber-700 dark:text-amber-400">
                {candidate.sourceName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <p className="text-center text-lg font-semibold">{candidate.traitLabel}</p>
            <p className="text-sm text-black/60 dark:text-white/50">von {candidate.sourceName}</p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={keep} className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700">
            ✅ Behalten
          </button>
          <button onClick={reroll} className="rounded-md border border-black/15 dark:border-white/15 px-4 py-2 font-medium">
            🔄 Neu würfeln
          </button>
        </div>
        {picks.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-black/60 dark:text-white/50">Schon festgelegt</h3>
            <div className="flex flex-wrap gap-2">
              {picks.map((p) => (
                <span key={p.categoryId} className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs">
                  {FUSION_CATEGORIES.find((c) => c.id === p.categoryId)?.label}: {p.traitLabel}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const bounty = computeBounty(picks);
  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <h2 className="text-xl font-semibold">Dein Fusions-Pirat ist bereit!</h2>
      <div className="rounded-xl border border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-transparent p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-black/50 dark:text-white/40 mb-1">Kopfgeld</p>
        <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{formatBerry(bounty)}</p>
      </div>
      <ol className="flex flex-col gap-2">
        {picks.map((p) => (
          <li key={p.categoryId} className="flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm">
            {p.sourceImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.sourceImageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-full object-cover object-top border border-black/10 dark:border-white/10"
              />
            ) : (
              <span className="h-10 w-10 rounded-full bg-amber-500/15" />
            )}
            <div>
              <p className="font-medium">
                {FUSION_CATEGORIES.find((c) => c.id === p.categoryId)?.label}: {p.traitLabel}
              </p>
              <p className="text-xs text-black/60 dark:text-white/50">von {p.sourceName}</p>
            </div>
          </li>
        ))}
      </ol>
      <button onClick={start} className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700">
        Neuen Fusions-Piraten würfeln
      </button>
      {history.length > 1 && (
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm">
          <p className="mb-2 font-medium">Frühere Kopfgelder</p>
          <ul className="space-y-0.5 text-xs text-black/60 dark:text-white/50">
            {history.slice(1, 6).map((h, i) => (
              <li key={i}>
                {h.date} – {formatBerry(h.bounty)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
