"use client";

import { useEffect, useRef, useState } from "react";
import { characters, getDefaultVersion } from "@/lib/characters";
import { acceptRoll, autoPick, createDraft, currentPlayer, getTeam, skipRoll, type DraftState } from "@/lib/draft";
import { simulateBattle, type BattleResult } from "@/lib/battle-sim";
import { generateAiTeam, generateImuBoss, type AiTeam, type Difficulty } from "@/lib/imu";
import { recordMatchResult } from "@/lib/supabase";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import { AnimatedBattleLog } from "./AnimatedBattleLog";
import { RollPanel } from "./RollPanel";
import { TimerBar } from "./TimerBar";
import { VictoryBanner } from "./VictoryBanner";

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

  const isBossFight = opponentName === "Imu";
  // Against Imu, only draft from the strongest characters (B-tier or
  // higher) — the whole point of the boss fight is a tough match, not a
  // roll that might hand the player five D-tier characters to lose with.
  const bossTierPool = ["S", "A", "B"];

  function startDraft() {
    const pool = isBossFight ? characters.filter((c) => bossTierPool.includes(c.tier)) : characters;
    const ids = pool.map((c) => c.id);
    setDraft(createDraft([playerName || "Du"], ids, teamSize));
    setSecondsLeft(PICK_SECONDS);
    setPhase("drafting");
  }

  function finishWithTeam(next: DraftState) {
    const ai = isBossFight ? generateImuBoss(difficulty) : generateAiTeam({ teamSize, difficulty, topShare, flatBonus });
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
    recordMatchResult(opponentName === "Imu" ? "imu" : "zufallsgegner", opponentName, run.result);
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
    playAccept();
    vibrate(30);
    applyDraft(acceptRoll(draft));
  }

  function handleSkip() {
    if (!draft) return;
    playSkip();
    vibrate(15);
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
          <TimerBar secondsLeft={secondsLeft} totalSeconds={PICK_SECONDS} />
        </div>
        <RollPanel character={rolled} skipsLeft={player.skipsLeft} onAccept={handleAccept} onSkip={handleSkip} />
      </div>
    );
  }

  if (phase === "result" && draft && opponentTeam && battle) {
    const playerWon = battle.winnerTeam === "A";
    const imuChar = isBossFight ? opponentTeam.characters[0] : null;
    return (
      <div className="flex flex-col gap-6">
        <VictoryBanner won={playerWon} />
        <h2 className="text-xl font-semibold">
          {playerWon ? `Gewonnen gegen ${opponentName}!` : `${opponentName} hat gewonnen.`}
        </h2>
        {playerWon && isBossFight && (
          <p className="-mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-400">
            🏆 Imu-Bezwinger
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-3">
            <p className="mb-2 font-semibold">{draft.players[0].name}</p>
            <ul className="space-y-1 text-sm">
              {draft.players[0].pickedCharacterIds.map((id) => (
                <li key={id}>{characters.find((c) => c.id === id)?.name}</li>
              ))}
            </ul>
          </div>
          <div
            className={`rounded-lg border p-3 ${isBossFight ? "op-s-tier-glow border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-transparent" : "border-black/10 dark:border-white/10"}`}
          >
            <p className="mb-2 font-semibold">{opponentName}</p>
            {imuChar?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imuChar.imageUrl}
                alt={imuChar.name}
                referrerPolicy="no-referrer"
                className="mb-2 h-32 w-auto rounded-lg border border-amber-500/40 object-cover object-top shadow-lg"
              />
            )}
            <ul className="space-y-1 text-sm">
              {opponentTeam.names.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="rounded-lg border border-amber-500/40 p-4">
          <p className="mb-2 font-semibold">Kampfverlauf</p>
          <AnimatedBattleLog battle={battle} />
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
