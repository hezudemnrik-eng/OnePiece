"use client";

import { useEffect, useRef, useState } from "react";
import { characters, getDefaultVersion, type Character } from "@/lib/characters";
import {
  autoPick,
  createDraft,
  currentPlayer,
  getTeam,
  getTeamSidePicks,
  pickCharacter,
  skipRoll,
  type DraftState,
  type DraftTeam,
} from "@/lib/draft";
import { simulateBattle, type BattleResult } from "@/lib/battle-sim";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import { getCurrentAuthUser } from "@/lib/supabase";
import { AnimatedBattleLog } from "./AnimatedBattleLog";
import { RollPanel } from "./RollPanel";
import { TimerBar } from "./TimerBar";
import { VictoryBanner } from "./VictoryBanner";

const PICK_SECONDS = 30;

type Phase = "setup" | "drafting" | "result";

function charactersFromIds(ids: string[]): Character[] {
  return ids.map((id) => characters.find((c) => c.id === id)).filter((c): c is Character => Boolean(c));
}

export function DraftBoard() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(["Spieler 1", "Spieler 2"]);
  const [teamSize, setTeamSize] = useState(5);
  const [teamMode, setTeamMode] = useState(false);
  const [spectatorsInput, setSpectatorsInput] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(PICK_SECONDS);
  const [battle, setBattle] = useState<BattleResult | null>(null);
  const [winnerLabel, setWinnerLabel] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hotseat mode is shared-device, but whoever's logged in on this device
  // is presumably Player 1 — prefill their name instead of a placeholder.
  useEffect(() => {
    getCurrentAuthUser().then((u) => {
      if (u?.username) setNames((prev) => [u.username as string, ...prev.slice(1)]);
    });
  }, []);

  function startDraft() {
    const ids = characters.map((c) => c.id);
    const teams: DraftTeam[] | undefined =
      teamMode && playerCount === 4 ? ["A", "A", "B", "B"] : undefined;
    const spectators = spectatorsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setDraft(createDraft(names.slice(0, playerCount), ids, teamSize, { teams, spectators }));
    setSecondsLeft(PICK_SECONDS);
    setPhase("drafting");
  }

  // Applies a new draft state and, the moment it comes out finished, derives
  // the battle result right here (not in an effect) so there is no extra
  // render cascade between "draft finished" and "result shown".
  function applyDraft(next: DraftState) {
    setDraft(next);
    if (!next.finished) {
      setSecondsLeft(PICK_SECONDS);
      return;
    }

    const isTeamMode = next.players.some((p) => p.team);
    if (isTeamMode) {
      const sideAIds = getTeamSidePicks(next, "A");
      const sideBIds = getTeamSidePicks(next, "B");
      const sideA = charactersFromIds(sideAIds);
      const sideB = charactersFromIds(sideBIds);
      const result = simulateBattle(
        sideA.map(getDefaultVersion),
        sideA.map((c) => c.name),
        sideB.map(getDefaultVersion),
        sideB.map((c) => c.name)
      );
      setBattle(result);
      const names = next.players
        .filter((p) => p.team === (result.winnerTeam === "A" ? "A" : "B"))
        .map((p) => p.name)
        .join(" & ");
      setWinnerLabel(`Team ${result.winnerTeam} (${names})`);
    } else if (next.players.length === 2) {
      const [p1, p2] = next.players;
      const teamA = getTeam(next, p1.id, characters).map(getDefaultVersion);
      const teamB = getTeam(next, p2.id, characters).map(getDefaultVersion);
      const result = simulateBattle(
        teamA,
        getTeam(next, p1.id, characters).map((c) => c.name),
        teamB,
        getTeam(next, p2.id, characters).map((c) => c.name)
      );
      setBattle(result);
      setWinnerLabel(next.players[result.winnerTeam === "A" ? 0 : 1].name);
    } else {
      setBattle(null);
    }
    setPhase("result");
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

  function handlePick(characterId: string) {
    if (!draft) return;
    playAccept();
    vibrate(30);
    applyDraft(pickCharacter(draft, characterId));
  }

  function handleSkip() {
    if (!draft) return;
    playSkip();
    vibrate(15);
    applyDraft(skipRoll(draft));
  }

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Anzahl Spieler (2–4)
          <input
            type="number"
            min={2}
            max={4}
            value={playerCount}
            onChange={(e) => {
              const n = Math.min(4, Math.max(2, Number(e.target.value) || 2));
              setPlayerCount(n);
              setNames((prev) => {
                const next = [...prev];
                while (next.length < n) next.push(`Spieler ${next.length + 1}`);
                return next.slice(0, n);
              });
            }}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          />
        </label>
        {names.slice(0, playerCount).map((name, i) => (
          <label key={i} className="flex flex-col gap-1 text-sm">
            Name Spieler {i + 1}
            <input
              value={name}
              onChange={(e) => {
                const next = [...names];
                next[i] = e.target.value;
                setNames(next);
              }}
              className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
            />
          </label>
        ))}
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
        {playerCount === 4 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={teamMode}
              onChange={(e) => setTeamMode(e.target.checked)}
            />
            Team-vs-Team (2 gegen 2: Spieler 1+2 vs. Spieler 3+4)
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Zuschauer (Namen, mit Komma getrennt)
          <input
            value={spectatorsInput}
            onChange={(e) => setSpectatorsInput(e.target.value)}
            placeholder="z. B. Lena, Tom"
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          />
        </label>
        <button
          onClick={startDraft}
          className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
        >
          Draft starten
        </button>
      </div>
    );
  }

  if (phase === "drafting" && draft) {
    const player = currentPlayer(draft);
    const offered = charactersFromIds(draft.rolledCharacterIds);
    return (
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p key={draft.currentPlayerIndex} className="op-turn-pulse text-sm">
              Am Zug: <span className="font-semibold">{player.name}</span> · Runde {draft.round}
            </p>
            <TimerBar secondsLeft={secondsLeft} totalSeconds={PICK_SECONDS} />
          </div>
          <RollPanel offered={offered} skipsLeft={player.skipsLeft} onPick={handlePick} onSkip={handleSkip} />
        </div>
        <aside className="flex flex-col gap-4">
          {draft.players.map((p) => (
            <div key={p.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
              <p className="mb-2 text-sm font-semibold">
                {p.name}
                {p.team && <span className="text-amber-600"> · Team {p.team}</span>} (
                {p.pickedCharacterIds.length}/{draft.teamSize})
              </p>
              <ul className="space-y-1 text-sm text-black/70 dark:text-white/60">
                {p.pickedCharacterIds.map((id) => (
                  <li key={id} className="op-slide-in">
                    {characters.find((c) => c.id === id)?.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {draft.spectators.length > 0 && (
            <div className="rounded-lg border border-dashed border-black/15 dark:border-white/15 p-3">
              <p className="mb-1 text-sm font-semibold">Zuschauer</p>
              <p className="text-sm text-black/60 dark:text-white/50">{draft.spectators.join(", ")}</p>
            </div>
          )}
        </aside>
      </div>
    );
  }

  if (phase === "result" && draft) {
    return (
      <div className="flex flex-col gap-6">
        {battle && <VictoryBanner won={null} label={`${winnerLabel} gewinnt!`} />}
        <h2 className="text-xl font-semibold">Draft beendet</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {draft.players.map((p) => (
            <div key={p.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
              <p className="mb-2 font-semibold">{p.name}</p>
              <ul className="space-y-1 text-sm">
                {p.pickedCharacterIds.map((id) => (
                  <li key={id}>{characters.find((c) => c.id === id)?.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {battle && (
          <div className="rounded-lg border border-amber-500/40 p-4">
            <p className="mb-2 font-semibold">Kampfsimulation: {winnerLabel} gewinnt!</p>
            <AnimatedBattleLog battle={battle} />
          </div>
        )}
        {!battle && draft.players.length > 2 && (
          <p className="text-sm text-black/60 dark:text-white/50">
            Die Kampfsimulation unterstützt aktuell 2 Spieler oder 2-vs-2 im
            Team-Modus. Freie Mehrspieler-Battle-Royale (3 Spieler ohne
            Teams) ist für eine spätere Phase vorgesehen.
          </p>
        )}
      </div>
    );
  }

  return null;
}
