"use client";

import { useEffect, useRef, useState } from "react";
import { characters, getDefaultVersion } from "@/lib/characters";
import { acceptRoll, autoPick, createDraft, currentPlayer, getTeam, skipRoll, type DraftState } from "@/lib/draft";
import { simulateBattle, type BattleResult } from "@/lib/battle-sim";
import { generateAiTeam, type AiTeam, type Difficulty } from "@/lib/imu";
import { RollPanel } from "./RollPanel";

const PICK_SECONDS = 30;

type Phase = "setup" | "drafting" | "result";

type RunRecord = { date: string; result: "win" | "loss"; rounds: number };

function loadRuns(storageKey: string): RunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
  } catch {
    return [];
  }
}

function saveRun(storageKey: string, run: RunRecord) {
  try {
    const runs = [run, ...loadRuns(storageKey)].slice(0, 20);
    window.localStorage.setItem(storageKey, JSON.stringify(runs));
  } catch {
    // ignore
  }
}

type Props = {
  opponentName: string;
  difficulty: Difficulty;
  flatBonus?: number;
  topShare?: number;
  storageKey: string;
};

export function SoloDraftBoard({ opponentName, difficulty, flatBonus = 0, topShare = 0.5, storageKey }: Props) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [playerName, setPlayerName] = useState("Du");
  const [teamSize, setTeamSize] = useState(5);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(PICK_SECONDS);
  const [opponentTeam, setOpponentTeam] = useState<AiTeam | null>(null);
  const [battle, setBattle] = useState<BattleResult | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>(() => loadRuns(storageKey));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startDraft() {
    const ids = characters.map((c) => c.id);
    setDraft(createDraft([playerName || "Du"], ids, teamSize));
    setSecondsLeft(PICK_SECONDS);
    setPhase("drafting");
  }

  function finishWithTeam(next: DraftState) {
    const ai = generateAiTeam({ teamSize, difficulty, topShare, flatBonus });
    setOpponentTeam(ai);
    const player = next.players[0];
    const playerVersions = getTeam(next, player.id, characters).map(getDefaultVersion);
    const playerNames = getTeam(next, player.id, characters).map((c) => c.name);
    const result = simulateBattle(playerVersions, playerNames, ai.versions, ai.names);
    setBattle(result);
    const run: RunRecord = {
      date: new Date().toLocaleString("de-DE"),
      result: result.winnerTeam === "A" ? "win" : "loss",
      rounds: result.rounds.at(-1)?.round ?? 0,
    };
    saveRun(storageKey, run);
    setRuns(loadRuns(storageKey));
    setPhase("result");
  }

  function applyDraft(next: DraftState) {
    setDraft(next);
    if (next.finished) {
      finishWithTeam(next);
    } else {
      setSecondsLeft(PICK_SECONDS);
    }
  }

  useEffect(() => {
    if (phase !== "drafting" || !draft || draft.finished) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          applyDraft(autoPick(draft));
          return PICK_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, draft?.currentPlayerIndex, draft?.finished]);

  function handleAccept() {
    if (!draft) return;
    applyDraft(acceptRoll(draft));
  }

  function handleSkip() {
    if (!draft) return;
    applyDraft(skipRoll(draft));
  }

  function playAgain() {
    setDraft(null);
    setBattle(null);
    setOpponentTeam(null);
    setPhase("setup");
  }

  if (phase === "setup") {
    const wins = runs.filter((r) => r.result === "win").length;
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Dein Name
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Teamgröße
          <input
            type="number"
            min={1}
            max={10}
            value={teamSize}
            onChange={(e) => setTeamSize(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          />
        </label>
        <button
          onClick={startDraft}
          className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
        >
          Draft gegen {opponentName} starten
        </button>
        {runs.length > 0 && (
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm">
            <p className="mb-2 font-medium">
              Bisher: {wins} Siege / {runs.length} Versuche
            </p>
            <ul className="space-y-0.5 text-xs text-black/60 dark:text-white/50">
              {runs.slice(0, 5).map((r, i) => (
                <li key={i}>
                  {r.date} – {r.result === "win" ? "Sieg" : "Niederlage"} (Runden: {r.rounds})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (phase === "drafting" && draft) {
    const player = currentPlayer(draft);
    const rolled = draft.rolledCharacterId
      ? characters.find((c) => c.id === draft.rolledCharacterId) ?? null
      : null;
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm">
            Dein Pick: <span className="font-semibold">{player.name}</span> ({player.pickedCharacterIds.length}/{draft.teamSize})
          </p>
          <p className="text-sm font-mono tabular-nums">{secondsLeft}s</p>
        </div>
        <RollPanel character={rolled} skipsLeft={player.skipsLeft} onAccept={handleAccept} onSkip={handleSkip} />
      </div>
    );
  }

  if (phase === "result" && draft && opponentTeam && battle) {
    const playerWon = battle.winnerTeam === "A";
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">
          {playerWon ? `Gewonnen gegen ${opponentName}!` : `${opponentName} hat gewonnen.`}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-3">
            <p className="mb-2 font-semibold">{draft.players[0].name}</p>
            <ul className="space-y-1 text-sm">
              {draft.players[0].pickedCharacterIds.map((id) => (
                <li key={id}>{characters.find((c) => c.id === id)?.name}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-3">
            <p className="mb-2 font-semibold">{opponentName}</p>
            <ul className="space-y-1 text-sm">
              {opponentTeam.names.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="rounded-lg border border-amber-500/40 p-4">
          <p className="mb-2 font-semibold">Kampfverlauf</p>
          <div className="max-h-48 overflow-y-auto text-xs font-mono space-y-0.5">
            {battle.rounds.map((r, i) => (
              <p key={i}>
                R{r.round}: {r.attackerName} → {r.defenderName} {r.critical ? "KRITISCH " : ""}
                -{r.damage} (HP danach: {r.defenderHpAfter})
              </p>
            ))}
          </div>
        </div>
        <button
          onClick={playAgain}
          className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
        >
          Nochmal versuchen
        </button>
      </div>
    );
  }

  return null;
}
