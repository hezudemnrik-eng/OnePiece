"use client";

import { useState } from "react";
import type { Character } from "@/lib/characters";
import { CREW_ROLES, rollCandidate, summarizeCrew, type CrewPick } from "@/lib/crewBuilder";
import { XP_CREW_COMPLETE } from "@/lib/levels";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import { recordCrewCompletion } from "@/lib/supabase";

type Phase = "setup" | "rolling" | "done";

const HISTORY_KEY = "op-crew-history";

type HistoryRecord = { date: string; grade: string; totalPower: number; names: string[] };

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

export function CrewBuilderBoard() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [roleIndex, setRoleIndex] = useState(0);
  const [candidate, setCandidate] = useState<Character | null>(null);
  const [picks, setPicks] = useState<CrewPick[]>([]);
  const [rerolls, setRerolls] = useState(0);
  const [rerollUsedThisRound, setRerollUsedThisRound] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());

  const currentRole = CREW_ROLES[roleIndex];

  function reroll() {
    if (rerollUsedThisRound) return;
    playSkip();
    vibrate(15);
    setRerolls((r) => r + 1);
    setRerollUsedThisRound(true);
    setCandidate(rollCandidate([...picks.map((p) => p.character.id), ...(candidate ? [candidate.id] : [])]));
  }

  function keep() {
    if (!candidate) return;
    playAccept();
    vibrate(25);
    const next = [...picks, { role: currentRole, character: candidate }];
    setPicks(next);
    if (roleIndex + 1 < CREW_ROLES.length) {
      setRoleIndex(roleIndex + 1);
      setRerollUsedThisRound(false);
      setCandidate(rollCandidate(next.map((p) => p.character.id)));
    } else {
      const summary = summarizeCrew(next);
      saveHistory({
        date: new Date().toLocaleString("de-DE"),
        grade: summary.grade,
        totalPower: summary.totalPower,
        names: next.map((p) => p.character.name),
      });
      setHistory(loadHistory());
      setPhase("done");
      recordCrewCompletion(XP_CREW_COMPLETE);
    }
  }

  function start() {
    setPhase("rolling");
    setRoleIndex(0);
    setPicks([]);
    setRerolls(0);
    setRerollUsedThisRound(false);
    setCandidate(rollCandidate([]));
  }

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <p className="text-sm text-black/60 dark:text-white/50">
          Für jede der {CREW_ROLES.length} Rollen bekommst du einen zufälligen Charakter vorgeschlagen. Du entscheidest:
          behalten oder neu würfeln — maximal einmal pro Rolle.
        </p>
        <button
          onClick={start}
          className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
        >
          Crew-Aufbau starten
        </button>
        {history.length > 0 && (
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm">
            <p className="mb-2 font-medium">Frühere Crews</p>
            <ul className="space-y-0.5 text-xs text-black/60 dark:text-white/50">
              {history.slice(0, 5).map((h, i) => (
                <li key={i}>
                  {h.date} – Note {h.grade} ({h.totalPower})
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
        <div className="flex items-center justify-between text-sm text-black/50 dark:text-white/40">
          <span>
            Rolle {roleIndex + 1} / {CREW_ROLES.length}
          </span>
          <span>{rerolls} Rerolls bisher</span>
        </div>
        <h2 className="text-xl font-semibold">{currentRole}</h2>
        {candidate && (
          <div className="op-parchment flex flex-col items-center gap-3 rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent p-6">
            {candidate.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={candidate.imageUrl}
                alt={candidate.name}
                referrerPolicy="no-referrer"
                className="h-36 w-auto rounded-lg border border-amber-500/40 object-cover object-top shadow-lg"
              />
            ) : (
              <span className="flex h-36 w-28 items-center justify-center rounded-lg bg-amber-500/15 text-3xl font-bold text-amber-700 dark:text-amber-400">
                {candidate.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <p className="text-lg font-semibold">{candidate.name}</p>
            <p className="text-sm text-black/60 dark:text-white/50">
              {candidate.crew} · eigentlich {candidate.role}
              {candidate.role !== currentRole && " (Rollen-Mismatch möglich)"}
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={keep}
            className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
          >
            ✅ Behalten für {currentRole}
          </button>
          <button
            onClick={reroll}
            disabled={rerollUsedThisRound}
            title={rerollUsedThisRound ? "Nur ein Reroll pro Rolle erlaubt" : undefined}
            className="rounded-md border border-black/15 dark:border-white/15 px-4 py-2 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🔄 {rerollUsedThisRound ? "Reroll verbraucht" : "Neu würfeln"}
          </button>
        </div>
        {picks.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-black/60 dark:text-white/50">Schon fest in der Crew</h3>
            <div className="flex flex-wrap gap-2">
              {picks.map((p) => (
                <span
                  key={p.role}
                  className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs"
                >
                  {p.role}: {p.character.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const summary = summarizeCrew(picks);
  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Deine Crew steht!</h2>
        <span className="rounded-full bg-amber-600 text-white px-3 py-1 text-sm font-bold">Note {summary.grade}</span>
      </div>
      <p className="text-sm text-black/60 dark:text-white/50">Gesamtstärke: {summary.totalPower}</p>
      <ol className="flex flex-col gap-2">
        {picks.map((p) => (
          <li
            key={p.role}
            className="flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm"
          >
            {p.character.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.character.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-full object-cover object-top border border-black/10 dark:border-white/10"
              />
            ) : (
              <span className="h-10 w-10 rounded-full bg-amber-500/15" />
            )}
            <div>
              <p className="font-medium">
                {p.role}: {p.character.name}
              </p>
              <p className="text-xs text-black/60 dark:text-white/50">{p.character.crew}</p>
            </div>
          </li>
        ))}
      </ol>
      <button
        onClick={start}
        className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
      >
        Neue Crew würfeln
      </button>
      {history.length > 1 && (
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm">
          <p className="mb-2 font-medium">Frühere Crews</p>
          <ul className="space-y-0.5 text-xs text-black/60 dark:text-white/50">
            {history.slice(1, 6).map((h, i) => (
              <li key={i}>
                {h.date} – Note {h.grade} ({h.totalPower})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
