"use client";

import { useState } from "react";
import { getStrongestVersion, type Character } from "@/lib/characters";
import { applyRoleFit } from "@/lib/crewRoles";
import { CREW_ROLES, rollCandidate, rollOpposingCrew, summarizeCrew, type CrewPick } from "@/lib/crewBuilder";
import { simulateBattle, type BattleResult } from "@/lib/battle-sim";
import { checkCrewAchievements, type CrewAchievement } from "@/lib/crewAchievements";
import { XP_ACHIEVEMENT_BONUS, XP_CREW_COMPLETE } from "@/lib/levels";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import { incrementXp, recordCrewCompletion, unlockAchievement } from "@/lib/supabase";
import { AnimatedBattleLog } from "./AnimatedBattleLog";
import { VictoryBanner } from "./VictoryBanner";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

const TIER_RARITY: Record<Character["tier"], "legendary" | "gold" | "silver" | "bronze"> = {
  S: "legendary",
  A: "gold",
  B: "silver",
  C: "bronze",
  D: "bronze",
};

type Phase = "setup" | "rolling" | "done" | "duel";

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

function adjustedVersions(picks: CrewPick[]) {
  return picks.map(({ role, character }) => ({
    ...getStrongestVersion(character),
    stats: applyRoleFit(getStrongestVersion(character).stats, character.role, role),
  }));
}

export function CrewBuilderBoard() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [roleIndex, setRoleIndex] = useState(0);
  const [candidate, setCandidate] = useState<Character | null>(null);
  const [picks, setPicks] = useState<CrewPick[]>([]);
  const [rerolls, setRerolls] = useState(0);
  const [rerollUsedThisRound, setRerollUsedThisRound] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());
  const [newAchievements, setNewAchievements] = useState<CrewAchievement[]>([]);
  const [opponentPicks, setOpponentPicks] = useState<CrewPick[]>([]);
  const [battle, setBattle] = useState<BattleResult | null>(null);

  const currentRole = CREW_ROLES[roleIndex];

  async function finalizeCrew(finalPicks: CrewPick[], rerollCount: number) {
    const summary = summarizeCrew(finalPicks);
    const earned = checkCrewAchievements(finalPicks, summary, rerollCount);
    if (earned.length === 0) return;
    const results = await Promise.all(earned.map(async (a) => ({ a, isNew: await unlockAchievement(a.id) })));
    const fresh = results.filter((r) => r.isNew).map((r) => r.a);
    if (fresh.length > 0) {
      incrementXp(fresh.length * XP_ACHIEVEMENT_BONUS);
      setNewAchievements(fresh);
    }
  }

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
      setNewAchievements([]);
      setPhase("done");
      recordCrewCompletion(XP_CREW_COMPLETE);
      finalizeCrew(next, rerolls);
    }
  }

  function start() {
    setPhase("rolling");
    setRoleIndex(0);
    setPicks([]);
    setRerolls(0);
    setRerollUsedThisRound(false);
    setNewAchievements([]);
    setCandidate(rollCandidate([]));
  }

  function startTeamDuel() {
    const opponent = rollOpposingCrew();
    setOpponentPicks(opponent);
    const result = simulateBattle(
      adjustedVersions(picks),
      picks.map((p) => p.character.name),
      adjustedVersions(opponent),
      opponent.map((p) => p.character.name)
    );
    setBattle(result);
    playAccept();
    vibrate(25);
    setPhase("duel");
  }

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <p className="text-sm text-black/60 dark:text-white/50">
          Für jede der {CREW_ROLES.length} Rollen bekommst du einen zufälligen Charakter vorgeschlagen. Du entscheidest:
          behalten oder neu würfeln — maximal einmal pro Rolle.
        </p>
        <Button onClick={start} className="self-start">
          Crew-Aufbau starten
        </Button>
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
          <div className="op-wanted op-parchment relative flex flex-col items-center gap-3 rounded-xl p-4">
            <Badge rarity={TIER_RARITY[candidate.tier]} className="absolute -top-2 -right-2">
              {candidate.tier}
            </Badge>
            {candidate.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={candidate.imageUrl}
                alt={candidate.name}
                referrerPolicy="no-referrer"
                className="h-36 w-auto rounded-lg border-2 border-poster-ink object-cover object-top"
              />
            ) : (
              <span className="flex h-36 w-28 items-center justify-center rounded-lg border-2 border-poster-ink bg-mode-crew/15 text-3xl font-bold">
                {candidate.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <p className="font-[family-name:var(--font-display)] text-lg">{candidate.name}</p>
            <p className="text-sm opacity-70">
              {candidate.crew} · eigentlich {candidate.role}
              {candidate.role !== currentRole && " (Rollen-Mismatch möglich)"}
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <Button onClick={keep}>✅ Behalten für {currentRole}</Button>
          <Button
            variant="secondary"
            onClick={reroll}
            disabled={rerollUsedThisRound}
            title={rerollUsedThisRound ? "Nur ein Reroll pro Rolle erlaubt" : undefined}
          >
            🔄 {rerollUsedThisRound ? "Reroll verbraucht" : "Neu würfeln"}
          </Button>
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

  if (phase === "duel" && battle) {
    const won = battle.winnerTeam === "A";
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <VictoryBanner won={won} label={won ? "Deine Crew gewinnt!" : "Die gegnerische Crew gewinnt!"} />
        <h2 className="text-xl font-semibold">{won ? "Sieg für deine Crew!" : "Niederlage"}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="mb-2 text-sm font-medium text-black/60 dark:text-white/50">Deine Crew</h3>
            <ul className="flex flex-col gap-1.5">
              {picks.map((p) => (
                <li key={p.role} className="text-xs rounded-md border border-mode-crew/30 px-2 py-1">
                  {p.role}: {p.character.name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-black/60 dark:text-white/50">Gegnerische Crew</h3>
            <ul className="flex flex-col gap-1.5">
              {opponentPicks.map((p) => (
                <li key={p.role} className="text-xs rounded-md border border-black/10 dark:border-white/10 px-2 py-1">
                  {p.role}: {p.character.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="rounded-lg border border-mode-crew/40 p-4">
          <p className="mb-2 font-semibold">Kampfverlauf</p>
          <AnimatedBattleLog battle={battle} />
        </div>
        <div className="flex gap-3">
          <Button onClick={startTeamDuel}>Nochmal gegen eine neue Crew</Button>
          <Button variant="secondary" onClick={() => setPhase("done")}>
            Zurück zur Crew
          </Button>
        </div>
      </div>
    );
  }

  const summary = summarizeCrew(picks);
  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Deine Crew steht!</h2>
        <span className="rounded-full bg-mode-crew text-white px-3 py-1 text-sm font-bold">Note {summary.grade}</span>
      </div>
      {newAchievements.length > 0 && (
        <div className="op-pop-in rounded-xl border border-accent bg-accent/10 p-3">
          <p className="mb-1 text-sm font-semibold text-accent">🏆 Neue Erfolge freigeschaltet!</p>
          <ul className="flex flex-col gap-0.5 text-xs text-black/70 dark:text-white/60">
            {newAchievements.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.label}</span> — {a.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="text-sm text-black/60 dark:text-white/50">
        <p>
          Gesamtstärke: <span className="font-semibold text-black dark:text-white">{summary.totalPower}</span>
          {summary.synergyBonus > 0 && (
            <>
              {" "}
              ({summary.basePower} Basis + {summary.synergyBonus} Synergie-Bonus)
            </>
          )}
        </p>
        {summary.synergyGroups.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-2">
            {summary.synergyGroups.map((g) => (
              <li key={g.crew} className="rounded-full bg-mode-crew/10 border border-mode-crew/30 px-2.5 py-0.5 text-xs">
                {g.crew} ×{g.count} → +{g.bonus}
              </li>
            ))}
          </ul>
        )}
      </div>
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
              <span className="h-10 w-10 rounded-full bg-mode-crew/15" />
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
      <div className="flex flex-wrap gap-3">
        <Button onClick={start}>Neue Crew würfeln</Button>
        <Button variant="secondary" onClick={startTeamDuel}>
          ⚔️ Team-Duell gegen zufällige Crew
        </Button>
      </div>
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
