"use client";

import { useEffect, useRef, useState } from "react";
import { characters, getDefaultVersion, type Character } from "@/lib/characters";
import { autoPick, createDraft, currentPlayer, getTeam, pick, type DraftState } from "@/lib/draft";
import { simulateBattle, type BattleResult } from "@/lib/battle-sim";
import { CharacterCard } from "./CharacterCard";

const PICK_SECONDS = 30;

type Phase = "setup" | "drafting" | "result";

export function DraftBoard() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(["Spieler 1", "Spieler 2"]);
  const [teamSize, setTeamSize] = useState(5);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(PICK_SECONDS);
  const [battle, setBattle] = useState<BattleResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startDraft() {
    const ids = characters.map((c) => c.id);
    setDraft(createDraft(names.slice(0, playerCount), ids, teamSize));
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
    if (next.players.length === 2) {
      const [p1, p2] = next.players;
      const teamA = getTeam(next, p1.id, characters).map(getDefaultVersion);
      const teamB = getTeam(next, p2.id, characters).map(getDefaultVersion);
      setBattle(
        simulateBattle(
          teamA,
          getTeam(next, p1.id, characters).map((c) => c.name),
          teamB,
          getTeam(next, p2.id, characters).map((c) => c.name)
        )
      );
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
    applyDraft(pick(draft, characterId));
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
    return (
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm">
              Am Zug: <span className="font-semibold">{player.name}</span> · Runde {draft.round}
            </p>
            <p className="text-sm font-mono tabular-nums">{secondsLeft}s</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {draft.availableCharacterIds.map((id) => {
              const c = characters.find((ch) => ch.id === id) as Character;
              return (
                <CharacterCard key={id} character={c} onClick={handlePick} />
              );
            })}
          </div>
        </div>
        <aside className="flex flex-col gap-4">
          {draft.players.map((p) => (
            <div key={p.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
              <p className="mb-2 text-sm font-semibold">
                {p.name} ({p.pickedCharacterIds.length}/{draft.teamSize})
              </p>
              <ul className="space-y-1 text-sm text-black/70 dark:text-white/60">
                {p.pickedCharacterIds.map((id) => (
                  <li key={id}>{characters.find((c) => c.id === id)?.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
      </div>
    );
  }

  if (phase === "result" && draft) {
    return (
      <div className="flex flex-col gap-6">
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
            <p className="mb-2 font-semibold">
              Kampfsimulation: {draft.players[battle.winnerTeam === "A" ? 0 : 1].name} gewinnt!
            </p>
            <div className="max-h-48 overflow-y-auto text-xs font-mono space-y-0.5">
              {battle.rounds.map((r, i) => (
                <p key={i}>
                  R{r.round}: {r.attackerName} → {r.defenderName}{" "}
                  {r.critical ? "KRITISCH " : ""}
                  -{r.damage} (HP danach: {r.defenderHpAfter})
                </p>
              ))}
            </div>
          </div>
        )}
        {!battle && draft.players.length > 2 && (
          <p className="text-sm text-black/60 dark:text-white/50">
            Die Kampfsimulation unterstützt aktuell 2 Spieler. Mehrspieler-Battle-Royale ist für eine spätere Phase vorgesehen.
          </p>
        )}
      </div>
    );
  }

  return null;
}
