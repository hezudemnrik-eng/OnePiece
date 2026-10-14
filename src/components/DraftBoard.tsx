"use client";

import { useEffect, useRef, useState } from "react";
import { characters, type Character, type Role } from "@/lib/characters";
import {
  assignRole,
  autoPick,
  createDraft,
  currentPlayer,
  getTeam,
  pickCharacter,
  resolveTeamRoleConflicts,
  skipRoll,
  type DraftState,
  type DraftTeam,
} from "@/lib/draft";
import { simulateBattle, type BattleResult } from "@/lib/battle-sim";
import { getRoleAdjustedVersions } from "@/lib/crewRoles";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import { fetchMyShopPurchases, getCurrentAuthUser } from "@/lib/supabase";
import { AnimatedBattleLog } from "./AnimatedBattleLog";
import { RoleAssignmentPanel } from "./RoleAssignmentPanel";
import { RollPanel } from "./RollPanel";
import { TimerBar } from "./TimerBar";
import { VictoryBanner } from "./VictoryBanner";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";

const PICK_SECONDS = 30;

type Phase = "setup" | "drafting" | "roles" | "result";

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
  const [roleStepIndex, setRoleStepIndex] = useState(0);
  const [roleConflictsResolved, setRoleConflictsResolved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hasExtraReroll, setHasExtraReroll] = useState(false);

  // Hotseat mode is shared-device, but whoever's logged in on this device
  // is presumably Player 1 — prefill their name instead of a placeholder.
  useEffect(() => {
    getCurrentAuthUser().then((u) => {
      if (u?.username) setNames((prev) => [u.username as string, ...prev.slice(1)]);
    });
    // Shop-Boost "Extra-Würfelversuch" (migration 0019): +1 Reroll pro Zug, gilt für das ganze Hotseat-Gerät.
    fetchMyShopPurchases().then((owned) => setHasExtraReroll(owned.has("boost_extra_reroll")));
  }, []);

  function startDraft() {
    const ids = characters.map((c) => c.id);
    const teams: DraftTeam[] | undefined =
      teamMode && playerCount === 4 ? ["A", "A", "B", "B"] : undefined;
    const spectators = spectatorsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setDraft(
      createDraft(names.slice(0, playerCount), ids, teamSize, {
        teams,
        spectators,
        skipsPerTurn: hasExtraReroll ? 2 : 1,
      })
    );
    setSecondsLeft(PICK_SECONDS);
    setRoleConflictsResolved(false);
    setPhase("drafting");
  }

  // Applies a new draft state and, the moment it comes out finished, moves
  // to the role-assignment step (if a battle can actually be computed for
  // this player setup) rather than straight to the result.
  function applyDraft(next: DraftState) {
    setDraft(next);
    if (!next.finished) {
      setSecondsLeft(PICK_SECONDS);
      return;
    }
    const isTeamMode = next.players.some((p) => p.team);
    if (isTeamMode || next.players.length === 2) {
      setRoleStepIndex(0);
      setPhase("roles");
    } else {
      setBattle(null);
      setPhase("result");
    }
  }

  function handleAssignRole(characterId: string, role: Role) {
    if (!draft) return;
    const player = draft.players[roleStepIndex];
    setDraft(assignRole(draft, player.id, characterId, role));
  }

  // Each player assigns roles to their own roster in turn, then the
  // battle is computed with every player's bonus/malus applied.
  function nextRoleStep() {
    if (!draft) return;
    if (roleStepIndex < draft.players.length - 1) {
      setRoleStepIndex(roleStepIndex + 1);
      return;
    }
    computeBattle(draft);
  }

  function computeBattle(rawNext: DraftState) {
    const isTeamMode = rawNext.players.some((p) => p.team);
    // Teammates assigned roles independently of each other — resolve any
    // clash over the same crew position by lottery before the battle (Q104).
    const next = isTeamMode ? resolveTeamRoleConflicts(rawNext) : rawNext;
    setRoleConflictsResolved(
      isTeamMode && JSON.stringify(next.players.map((p) => p.roleAssignments)) !== JSON.stringify(rawNext.players.map((p) => p.roleAssignments))
    );
    if (isTeamMode) {
      const sideA = next.players.filter((p) => p.team === "A");
      const sideB = next.players.filter((p) => p.team === "B");
      const sideAVersions = sideA.flatMap((p) => getRoleAdjustedVersions(getTeam(next, p.id, characters), p.roleAssignments));
      const sideANames = sideA.flatMap((p) => getTeam(next, p.id, characters).map((c) => c.name));
      const sideBVersions = sideB.flatMap((p) => getRoleAdjustedVersions(getTeam(next, p.id, characters), p.roleAssignments));
      const sideBNames = sideB.flatMap((p) => getTeam(next, p.id, characters).map((c) => c.name));
      const result = simulateBattle(sideAVersions, sideANames, sideBVersions, sideBNames);
      setBattle(result);
      setDraft(next);
      const names = next.players
        .filter((p) => p.team === (result.winnerTeam === "A" ? "A" : "B"))
        .map((p) => p.name)
        .join(" & ");
      setWinnerLabel(`Team ${result.winnerTeam} (${names})`);
    } else if (next.players.length === 2) {
      const [p1, p2] = next.players;
      const rosterA = getTeam(next, p1.id, characters);
      const rosterB = getTeam(next, p2.id, characters);
      const teamA = getRoleAdjustedVersions(rosterA, p1.roleAssignments);
      const teamB = getRoleAdjustedVersions(rosterB, p2.roleAssignments);
      const result = simulateBattle(
        teamA,
        rosterA.map((c) => c.name),
        teamB,
        rosterB.map((c) => c.name)
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
      <Card variant="spotlight" accent="draft" className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Anzahl Spieler (2–4)
          <Input
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
          />
        </label>
        {names.slice(0, playerCount).map((name, i) => (
          <label key={i} className="flex flex-col gap-1 text-sm">
            Name Spieler {i + 1}
            <Input
              value={name}
              onChange={(e) => {
                const next = [...names];
                next[i] = e.target.value;
                setNames(next);
              }}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-sm">
          Teamgröße
          <Input
            type="number"
            min={1}
            max={10}
            value={teamSize}
            onChange={(e) => setTeamSize(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
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
          <Input
            value={spectatorsInput}
            onChange={(e) => setSpectatorsInput(e.target.value)}
            placeholder="z. B. Lena, Tom"
          />
        </label>
        <Button onClick={startDraft} className="self-start">
          Draft starten
        </Button>
      </Card>
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
            <Card key={p.id} variant="framed" accent="draft" className="p-3">
              <p className="mb-2 text-sm font-semibold">
                {p.name}
                {p.team && <span className="text-mode-draft"> · Team {p.team}</span>} (
                {p.pickedCharacterIds.length}/{draft.teamSize})
              </p>
              <ul className="space-y-1 text-sm text-black/70 dark:text-white/60">
                {p.pickedCharacterIds.map((id) => (
                  <li key={id} className="op-slide-in">
                    {characters.find((c) => c.id === id)?.name}
                  </li>
                ))}
              </ul>
            </Card>
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

  if (phase === "roles" && draft) {
    const player = draft.players[roleStepIndex];
    const roster = getTeam(draft, player.id, characters);
    const isLastStep = roleStepIndex === draft.players.length - 1;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-black/60 dark:text-white/50">
          Rollen für <span className="font-semibold text-black dark:text-white">{player.name}</span>
        </p>
        <RoleAssignmentPanel
          roster={roster}
          assignments={player.roleAssignments}
          onAssign={handleAssignRole}
          onConfirm={nextRoleStep}
          confirmLabel={isLastStep ? "Kampf starten" : "Weiter"}
        />
      </div>
    );
  }

  if (phase === "result" && draft) {
    return (
      <div className="flex flex-col gap-6">
        {battle && <VictoryBanner won={null} label={`${winnerLabel} gewinnt!`} />}
        <h2 className="text-xl font-semibold">Draft beendet</h2>
        {roleConflictsResolved && (
          <p className="text-sm text-mode-draft">⚖️ Zwei Team-Mitglieder wollten dieselbe Rolle — per Los entschieden.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {draft.players.map((p) => (
            <Card key={p.id} variant="framed" accent="draft" className="p-3">
              <p className="mb-2 font-semibold">{p.name}</p>
              <ul className="space-y-1 text-sm">
                {p.pickedCharacterIds.map((id) => (
                  <li key={id}>{characters.find((c) => c.id === id)?.name}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        {battle && (
          <Card variant="framed" accent="draft" className="p-4">
            <p className="mb-2 font-semibold">Kampfsimulation: {winnerLabel} gewinnt!</p>
            <AnimatedBattleLog battle={battle} />
          </Card>
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
