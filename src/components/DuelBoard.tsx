"use client";

import { useState } from "react";
import { characters, getStrongestVersion, type Character } from "@/lib/characters";
import { simulateBattle, type BattleResult } from "@/lib/battle-sim";
import { AnimatedBattleLog } from "./AnimatedBattleLog";
import { VictoryBanner } from "./VictoryBanner";
import { playAccept, vibrate } from "@/lib/sfx";

type Phase = "setup" | "result";

const HISTORY_KEY = "op-duell-history";
const RANDOM = "__random__";

type HistoryRecord = { date: string; a: string; b: string; winner: string };

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

function pickRandomCharacter(excludeId?: string): Character {
  const pool = excludeId ? characters.filter((c) => c.id !== excludeId) : characters;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function DuelBoard() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [choiceA, setChoiceA] = useState(RANDOM);
  const [choiceB, setChoiceB] = useState(RANDOM);
  const [fighterA, setFighterA] = useState<Character | null>(null);
  const [fighterB, setFighterB] = useState<Character | null>(null);
  const [battle, setBattle] = useState<BattleResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());

  function startDuel() {
    const a = choiceA === RANDOM ? pickRandomCharacter() : characters.find((c) => c.id === choiceA)!;
    const b =
      choiceB === RANDOM
        ? pickRandomCharacter(choiceA === RANDOM ? a.id : undefined)
        : characters.find((c) => c.id === choiceB)!;
    setFighterA(a);
    setFighterB(b);
    const result = simulateBattle([getStrongestVersion(a)], [a.name], [getStrongestVersion(b)], [b.name]);
    setBattle(result);
    playAccept();
    vibrate(25);
    saveHistory({
      date: new Date().toLocaleString("de-DE"),
      a: a.name,
      b: b.name,
      winner: result.winnerTeam === "A" ? a.name : b.name,
    });
    setHistory(loadHistory());
    setPhase("result");
  }

  function reset() {
    setPhase("setup");
    setBattle(null);
    setFighterA(null);
    setFighterB(null);
  }

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-5 max-w-xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Charakter A
            <select
              value={choiceA}
              onChange={(e) => setChoiceA(e.target.value)}
              className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
            >
              <option value={RANDOM}>🎲 Zufällig</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Charakter B
            <select
              value={choiceB}
              onChange={(e) => setChoiceB(e.target.value)}
              className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
            >
              <option value={RANDOM}>🎲 Zufällig</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          onClick={startDuel}
          className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
        >
          ⚔️ Duell starten
        </button>
        {history.length > 0 && (
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm">
            <p className="mb-2 font-medium">Letzte Duelle</p>
            <ul className="space-y-0.5 text-xs text-black/60 dark:text-white/50">
              {history.slice(0, 5).map((h, i) => (
                <li key={i}>
                  {h.date} – {h.a} vs. {h.b}: <span className="font-medium">{h.winner}</span> gewinnt
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (phase === "result" && fighterA && fighterB && battle) {
    const aWon = battle.winnerTeam === "A";
    const winner = aWon ? fighterA : fighterB;
    return (
      <div className="flex flex-col gap-6 max-w-xl">
        <VictoryBanner won />
        <h2 className="text-xl font-semibold">{winner.name} gewinnt das Duell!</h2>
        <div className="grid grid-cols-2 gap-4">
          {[fighterA, fighterB].map((f, i) => (
            <div
              key={f.id}
              className={`op-parchment flex flex-col items-center gap-2 rounded-lg border p-4 ${
                f.id === winner.id ? "border-amber-500 bg-amber-500/10" : "border-black/10 dark:border-white/10"
              }`}
            >
              {f.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.imageUrl}
                  alt={f.name}
                  referrerPolicy="no-referrer"
                  className="h-28 w-auto rounded-lg object-cover object-top shadow"
                />
              ) : (
                <span className="flex h-28 w-20 items-center justify-center rounded-lg bg-amber-500/15 text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {f.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <p className="text-sm font-medium text-center">{f.name}</p>
              {i === 0 && <span className="text-xs text-black/50 dark:text-white/40">Charakter A</span>}
              {i === 1 && <span className="text-xs text-black/50 dark:text-white/40">Charakter B</span>}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-amber-500/40 p-4">
          <p className="mb-2 font-semibold">Kampfverlauf</p>
          <AnimatedBattleLog battle={battle} />
        </div>
        <button onClick={reset} className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700">
          Neues Duell
        </button>
      </div>
    );
  }

  return null;
}
