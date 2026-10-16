"use client";

import { useEffect, useRef, useState } from "react";
import { characters, type Character, type Role } from "@/lib/characters";
import { assignRole, autoAssignRoles, autoPick, createDraft, currentPlayer, getTeam, pickCharacter, skipRoll, type DraftState } from "@/lib/draft";
import { simulateBattle, type BattleResult } from "@/lib/battle-sim";
import { getRoleAdjustedVersions } from "@/lib/crewRoles";
import { generateAiTeam, generateImuBoss, type AiTeam, type Difficulty } from "@/lib/imu";
import { checkDraftAchievements, type DraftAchievement } from "@/lib/draftAchievements";
import { XP_ACHIEVEMENT_BONUS } from "@/lib/levels";
import { fetchMyShopPurchases, getCurrentAuthUser, incrementXp, recordMatchResult, unlockAchievement } from "@/lib/supabase";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import { AnimatedBattleLog } from "./AnimatedBattleLog";
import { RoleAssignmentPanel } from "./RoleAssignmentPanel";
import { RollPanel } from "./RollPanel";
import { TimerBar } from "./TimerBar";
import { VictoryBanner } from "./VictoryBanner";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import type { ModeAccent } from "./ui/modeAccents";

const TIER_RARITY: Record<Character["tier"], "legendary" | "gold" | "silver" | "bronze"> = {
  S: "legendary",
  A: "gold",
  B: "silver",
  C: "bronze",
  D: "bronze",
};

const PICK_SECONDS = 30;

type Phase = "setup" | "drafting" | "roles" | "result";

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
  const [newAchievements, setNewAchievements] = useState<DraftAchievement[]>([]);
  const [hasExtraReroll, setHasExtraReroll] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const accent: ModeAccent = opponentName === "Imu" ? "imu" : "zufallsgegner";

  useEffect(() => {
    getCurrentAuthUser().then((u) => {
      if (u?.username) setPlayerName(u.username);
    });
    // Shop-Boost "Extra-Würfelversuch" (migration 0019): +1 Reroll pro Zug, gilt pro Account.
    fetchMyShopPurchases().then((owned) => setHasExtraReroll(owned.has("boost_extra_reroll")));
  }, []);

  const isBossFight = opponentName === "Imu";
  // Against Imu, only draft from the strongest characters (B-tier or
  // higher) — the whole point of the boss fight is a tough match, not a
  // roll that might hand the player five D-tier characters to lose with.
  const bossTierPool = ["S", "A", "B"];

  function startDraft() {
    const pool = isBossFight ? characters.filter((c) => bossTierPool.includes(c.tier)) : characters;
    const ids = pool.map((c) => c.id);
    setDraft(createDraft([playerName || "Du"], ids, teamSize, { skipsPerTurn: hasExtraReroll ? 2 : 1 }));
    setSecondsLeft(PICK_SECONDS);
    setPhase("drafting");
  }

  async function finalizeDraft(roster: Character[], opponentRoster: Character[], won: boolean, roleAssignments: DraftState["players"][number]["roleAssignments"]) {
    if (!draft) return;
    const rerolls = draft.rerollsUsed?.[draft.players[0].id] ?? 0;
    const earned = checkDraftAchievements(roster, opponentRoster, won, rerolls, roleAssignments);
    if (earned.length === 0) return;
    const results = await Promise.all(earned.map(async (a) => ({ a, isNew: await unlockAchievement(a.id) })));
    const fresh = results.filter((r) => r.isNew).map((r) => r.a);
    if (fresh.length > 0) {
      incrementXp(fresh.length * XP_ACHIEVEMENT_BONUS);
      setNewAchievements(fresh);
    }
  }

  function startBattle() {
    if (!draft) return;
    const ai = isBossFight ? generateImuBoss(difficulty) : generateAiTeam({ teamSize, difficulty, topShare, flatBonus });
    setOpponentTeam(ai);
    const player = draft.players[0];
    const roster = getTeam(draft, player.id, characters);
    const playerVersions = getRoleAdjustedVersions(roster, player.roleAssignments);
    const playerNames = roster.map((c) => c.name);
    const result = simulateBattle(playerVersions, playerNames, ai.versions, ai.names);
    setBattle(result);
    const won = result.winnerTeam === "A";
    const run: RunRecord = {
      date: new Date().toLocaleString("de-DE"),
      result: won ? "win" : "loss",
      rounds: result.rounds.at(-1)?.round ?? 0,
    };
    saveRun(storageKey, run);
    setRuns(loadRuns(storageKey));
    setNewAchievements([]);
    setPhase("result");
    recordMatchResult(opponentName === "Imu" ? "imu" : "zufallsgegner", opponentName, run.result);
    finalizeDraft(roster, ai.characters, won, player.roleAssignments);
  }

  function handleAssignRole(characterId: string, role: Role) {
    setDraft((d) => (d ? assignRole(d, d.players[0].id, characterId, role) : d));
  }

  function handleAutoAssignRoles() {
    setDraft((d) => (d ? autoAssignRoles(d, d.players[0].id, characters) : d));
  }

  function applyDraft(next: DraftState) {
    setDraft(next);
    if (next.finished) {
      setPhase("roles");
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

  function playAgain() {
    setDraft(null);
    setBattle(null);
    setOpponentTeam(null);
    setNewAchievements([]);
    setPhase("setup");
  }

  if (phase === "setup") {
    const wins = runs.filter((r) => r.result === "win").length;
    return (
      <Card variant="spotlight" accent={accent} className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Dein Name
          <Input value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
        </label>
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
        <Button onClick={startDraft} className="self-start">
          Draft gegen {opponentName} starten
        </Button>
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
      </Card>
    );
  }

  if (phase === "drafting" && draft) {
    const player = currentPlayer(draft);
    const offered = draft.rolledCharacterIds
      .map((id) => characters.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm">
            Dein Pick: <span className="font-semibold">{player.name}</span> ({player.pickedCharacterIds.length}/{draft.teamSize})
          </p>
          <TimerBar secondsLeft={secondsLeft} totalSeconds={PICK_SECONDS} />
        </div>
        <RollPanel offered={offered} skipsLeft={player.skipsLeft} onPick={handlePick} onSkip={handleSkip} />
      </div>
    );
  }

  if (phase === "roles" && draft) {
    const player = draft.players[0];
    const roster = getTeam(draft, player.id, characters);
    return (
      <RoleAssignmentPanel
        roster={roster}
        assignments={player.roleAssignments}
        onAssign={handleAssignRole}
        onAutoAssign={handleAutoAssignRoles}
        onConfirm={startBattle}
        confirmLabel={`Kampf gegen ${opponentName} starten`}
      />
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
          <p className="-mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-mode-imu/15 px-3 py-1 text-sm font-medium text-mode-imu">
            🏆 Imu-Bezwinger
          </p>
        )}
        {newAchievements.length > 0 && (
          <div className="op-pop-in rounded-xl border border-accent bg-accent/10 p-3">
            <p className="mb-1 text-sm font-semibold text-accent-ink">🏆 Neue Erfolge freigeschaltet!</p>
            <ul className="flex flex-col gap-0.5 text-xs text-black/70 dark:text-white/60">
              {newAchievements.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.label}</span> — {a.description}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card variant="framed" accent={accent} className="p-3">
            <p className="mb-2 font-semibold">{draft.players[0].name}</p>
            <ul className="space-y-1 text-sm">
              {draft.players[0].pickedCharacterIds.map((id) => (
                <li key={id}>{characters.find((c) => c.id === id)?.name}</li>
              ))}
            </ul>
          </Card>
          <div className={`op-wanted op-parchment relative rounded-lg p-3 ${isBossFight ? "op-s-tier-glow" : ""}`}>
            {isBossFight && imuChar && (
              <Badge rarity={TIER_RARITY[imuChar.tier]} className="absolute -top-2 -right-2">
                {imuChar.tier}
              </Badge>
            )}
            <p className="mb-2 font-[family-name:var(--font-display)]">{opponentName}</p>
            {imuChar?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imuChar.imageUrl}
                alt={imuChar.name}
                referrerPolicy="no-referrer"
                className="mb-2 h-32 w-auto rounded-lg border-2 border-poster-ink object-cover object-top"
              />
            )}
            <ul className="space-y-1 text-sm">
              {opponentTeam.names.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </div>
        </div>
        <Card variant="framed" accent={accent} className="p-4">
          <p className="mb-2 font-semibold">Kampfverlauf</p>
          <AnimatedBattleLog battle={battle} />
        </Card>
        <Button onClick={playAgain} className="self-start">
          Nochmal versuchen
        </Button>
      </div>
    );
  }

  return null;
}
