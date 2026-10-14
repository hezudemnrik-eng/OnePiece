"use client";

import { useEffect, useState } from "react";
import { characters, getStrongestVersion, type Character, type Stats } from "@/lib/characters";
import { simulateBattle, type BattleResult } from "@/lib/battle-sim";
import { checkDuelAchievements, type DuelAchievement } from "@/lib/duelAchievements";
import { XP_ACHIEVEMENT_BONUS } from "@/lib/levels";
import { fetchMyLevelInfo, fetchShopItems, incrementXp, recordDuelCompletion, unlockAchievement } from "@/lib/supabase";
import { ARENA_IMAGES } from "@/lib/arenaImages";
import { AnimatedBattleLog } from "./AnimatedBattleLog";
import { VictoryBanner } from "./VictoryBanner";
import { playAccept, vibrate } from "@/lib/sfx";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { ProgressBar } from "./ui/ProgressBar";
import { Select } from "./ui/Select";

type Phase = "setup" | "result";
type Mode = "1v1" | "team";

const HISTORY_KEY = "op-duell-history";
const RANDOM = "__random__";
const TEAM_SIZE = 3;

const STAT_LABELS: Record<keyof Stats, string> = {
  staerke: "Stärke",
  haki: "Haki",
  intelligenz: "Intelligenz",
  geschwindigkeit: "Geschwindigkeit",
  durabilitaet: "Durabilität",
};
const STAT_KEYS = Object.keys(STAT_LABELS) as (keyof Stats)[];

const TIER_RARITY: Record<Character["tier"], "legendary" | "gold" | "silver" | "bronze"> = {
  S: "legendary",
  A: "gold",
  B: "silver",
  C: "bronze",
  D: "bronze",
};

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

function resolveChoice(choice: string, excludeIds: string[]): Character {
  if (choice !== RANDOM) return characters.find((c) => c.id === choice)!;
  const pool = characters.filter((c) => !excludeIds.includes(c.id));
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildTeam(choices: string[], excludeIds: string[]): Character[] {
  const team: Character[] = [];
  for (const choice of choices) {
    team.push(resolveChoice(choice, [...excludeIds, ...team.map((c) => c.id)]));
  }
  return team;
}

function sumStats(chars: Character[]): Stats {
  const sum: Stats = { staerke: 0, haki: 0, intelligenz: 0, geschwindigkeit: 0, durabilitaet: 0 };
  for (const c of chars) {
    const stats = getStrongestVersion(c).stats;
    for (const key of STAT_KEYS) sum[key] += stats[key];
  }
  return sum;
}

function StatBars({ statsA, statsB }: { statsA: Stats; statsB: Stats }) {
  return (
    <div className="flex flex-col gap-2">
      {STAT_KEYS.map((key) => {
        const a = statsA[key];
        const b = statsB[key];
        const total = a + b || 1;
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-8 shrink-0 text-right font-mono tabular-nums">{a}</span>
            <div className="flex-1">
              <ProgressBar progress={a / total} fillClassName="bg-mode-duell" />
            </div>
            <span className="w-8 shrink-0 font-mono tabular-nums">{b}</span>
            <span className="w-28 shrink-0 text-black/50 dark:text-white/40">{STAT_LABELS[key]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DuelBoard() {
  const [mode, setMode] = useState<Mode>("1v1");
  const [phase, setPhase] = useState<Phase>("setup");
  const [choiceA, setChoiceA] = useState(RANDOM);
  const [choiceB, setChoiceB] = useState(RANDOM);
  const [teamChoicesA, setTeamChoicesA] = useState<string[]>(() => Array(TEAM_SIZE).fill(RANDOM));
  const [teamChoicesB, setTeamChoicesB] = useState<string[]>(() => Array(TEAM_SIZE).fill(RANDOM));
  const [fightersA, setFightersA] = useState<Character[]>([]);
  const [fightersB, setFightersB] = useState<Character[]>([]);
  const [battle, setBattle] = useState<BattleResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());
  const [newAchievements, setNewAchievements] = useState<DuelAchievement[]>([]);
  // Cosmetic only (Q117) — resolved once per mount from the signed-in
  // user's equipped shop item, same className-driven pattern ProfileBoard
  // already uses for frames/colors/titles.
  const [arenaClassName, setArenaClassName] = useState("");
  const [arenaImage, setArenaImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyLevelInfo(), fetchShopItems()]).then(([info, items]) => {
      if (cancelled || !info?.equippedArena) return;
      const arena = items.find((i) => i.category === "arena" && i.id === info.equippedArena);
      if (arena) setArenaClassName(arena.className);
      setArenaImage(ARENA_IMAGES[info.equippedArena] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const arenaStyle = arenaImage
    ? {
        backgroundImage: `linear-gradient(var(--op-map-overlay), var(--op-map-overlay)), url('${arenaImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  async function finalizeDuel(winner: Character, loser: Character, result: BattleResult) {
    const earned = checkDuelAchievements(winner, loser, result);
    if (earned.length === 0) return;
    const results = await Promise.all(earned.map(async (a) => ({ a, isNew: await unlockAchievement(a.id) })));
    const fresh = results.filter((r) => r.isNew).map((r) => r.a);
    if (fresh.length > 0) {
      incrementXp(fresh.length * XP_ACHIEVEMENT_BONUS);
      setNewAchievements(fresh);
    }
  }

  function runBattle(a: Character[], b: Character[]) {
    const result = simulateBattle(
      a.map(getStrongestVersion),
      a.map((c) => c.name),
      b.map(getStrongestVersion),
      b.map((c) => c.name)
    );
    setFightersA(a);
    setFightersB(b);
    setBattle(result);
    playAccept();
    vibrate(25);
    saveHistory({
      date: new Date().toLocaleString("de-DE"),
      a: a.map((c) => c.name).join(" + "),
      b: b.map((c) => c.name).join(" + "),
      winner: (result.winnerTeam === "A" ? a : b).map((c) => c.name).join(" + "),
    });
    setHistory(loadHistory());
    setNewAchievements([]);
    setPhase("result");
    recordDuelCompletion();
    if (a.length === 1 && b.length === 1) {
      const winner = result.winnerTeam === "A" ? a[0] : b[0];
      const loser = result.winnerTeam === "A" ? b[0] : a[0];
      finalizeDuel(winner, loser, result);
    }
  }

  function startDuel() {
    if (mode === "1v1") {
      const a = resolveChoice(choiceA, []);
      const b = resolveChoice(choiceB, [a.id]);
      runBattle([a], [b]);
    } else {
      const a = buildTeam(teamChoicesA, []);
      const b = buildTeam(teamChoicesB, a.map((c) => c.id));
      runBattle(a, b);
    }
  }

  // One-click rematch (Q115): re-fights the same fighters without going
  // back through setup — a fresh random outcome since the simulation itself
  // still has variance/crits, just no re-drafting.
  function rematch() {
    if (fightersA.length === 0 || fightersB.length === 0) return;
    runBattle(fightersA, fightersB);
  }

  function reset() {
    setPhase("setup");
    setBattle(null);
    setFightersA([]);
    setFightersB([]);
    setNewAchievements([]);
  }

  if (phase === "setup") {
    return (
      <Card variant="spotlight" accent="duell" className="flex flex-col gap-5 max-w-xl">
        <div className="flex gap-2 rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm w-fit">
          <button
            onClick={() => setMode("1v1")}
            className={`rounded-md px-3 py-1.5 font-medium ${mode === "1v1" ? "bg-mode-duell text-poster-ink" : "text-black/60 dark:text-white/50"}`}
          >
            1 gegen 1
          </button>
          <button
            onClick={() => setMode("team")}
            className={`rounded-md px-3 py-1.5 font-medium ${mode === "team" ? "bg-mode-duell text-poster-ink" : "text-black/60 dark:text-white/50"}`}
          >
            Team-Duell (3 vs. 3)
          </button>
        </div>
        {mode === "1v1" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Charakter A
              <Select value={choiceA} onChange={(e) => setChoiceA(e.target.value)}>
                <option value={RANDOM}>🎲 Zufällig</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Charakter B
              <Select value={choiceB} onChange={(e) => setChoiceB(e.target.value)}>
                <option value={RANDOM}>🎲 Zufällig</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Team A", choices: teamChoicesA, setChoices: setTeamChoicesA },
              { label: "Team B", choices: teamChoicesB, setChoices: setTeamChoicesB },
            ].map(({ label, choices, setChoices }) => (
              <div key={label} className="flex flex-col gap-2">
                <p className="text-sm font-medium">{label}</p>
                {choices.map((choice, i) => (
                  <Select
                    key={i}
                    value={choice}
                    onChange={(e) =>
                      setChoices((prev) => prev.map((c, idx) => (idx === i ? e.target.value : c)))
                    }
                  >
                    <option value={RANDOM}>🎲 Zufällig</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                ))}
              </div>
            ))}
          </div>
        )}
        <Button onClick={startDuel} className="self-start">
          {mode === "1v1" ? "⚔️ Duell starten" : "⚔️ Team-Duell starten"}
        </Button>
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
      </Card>
    );
  }

  if (phase === "result" && fightersA.length > 0 && fightersB.length > 0 && battle) {
    const aWon = battle.winnerTeam === "A";

    if (fightersA.length === 1 && fightersB.length === 1) {
      const fighterA = fightersA[0];
      const fighterB = fightersB[0];
      const winner = aWon ? fighterA : fighterB;
      const statsA = getStrongestVersion(fighterA).stats;
      const statsB = getStrongestVersion(fighterB).stats;
      return (
        <div
          className={`flex flex-col gap-6 max-w-xl rounded-xl ${arenaImage ? "" : arenaClassName} ${arenaClassName || arenaImage ? "p-4" : ""}`}
          style={arenaStyle}
        >
          <VictoryBanner won />
          <h2 className="text-xl font-semibold">{winner.name} gewinnt das Duell!</h2>
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
          <div className="grid grid-cols-2 gap-4">
            {[fighterA, fighterB].map((f, i) => (
              <div
                key={f.id}
                className={`op-wanted op-parchment relative flex flex-col items-center gap-2 rounded-xl p-4 ${
                  f.id === winner.id ? "op-s-tier-glow" : ""
                }`}
              >
                <Badge rarity={TIER_RARITY[f.tier]} className="absolute -top-2 -right-2">
                  {f.tier}
                </Badge>
                {f.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.imageUrl}
                    alt={f.name}
                    referrerPolicy="no-referrer"
                    className="h-28 w-auto rounded-lg border-2 border-poster-ink object-cover object-top"
                  />
                ) : (
                  <span className="flex h-28 w-20 items-center justify-center rounded-lg border-2 border-poster-ink bg-mode-duell/15 text-2xl font-bold">
                    {f.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <p className="font-[family-name:var(--font-display)] text-base text-center">{f.name}</p>
                <span className="text-xs opacity-70">{i === 0 ? "Charakter A" : "Charakter B"}</span>
              </div>
            ))}
          </div>
          <Card variant="framed" accent="duell" className="p-4">
            <p className="mb-2 font-semibold text-sm">Stat-Vergleich</p>
            <StatBars statsA={statsA} statsB={statsB} />
          </Card>
          <Card variant="framed" accent="duell" className="p-4">
            <p className="mb-2 font-semibold">Kampfverlauf</p>
            <AnimatedBattleLog battle={battle} />
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button onClick={rematch}>🔁 Gleiche Kämpfer nochmal</Button>
            <Button variant="secondary" onClick={reset}>
              Neues Duell
            </Button>
          </div>
        </div>
      );
    }

    const winnerNames = (aWon ? fightersA : fightersB).map((c) => c.name).join(" & ");
    return (
      <div
        className={`flex flex-col gap-6 max-w-xl rounded-xl ${arenaImage ? "" : arenaClassName} ${arenaClassName || arenaImage ? "p-4" : ""}`}
        style={arenaStyle}
      >
        <VictoryBanner won={null} label={`Team ${battle.winnerTeam} gewinnt!`} />
        <h2 className="text-xl font-semibold">{winnerNames} gewinnt das Team-Duell!</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card variant={aWon ? "spotlight" : "framed"} accent="duell" className="p-3">
            <p className="mb-2 text-sm font-semibold">Team A</p>
            <ul className="space-y-1 text-sm">
              {fightersA.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          </Card>
          <Card variant={!aWon ? "spotlight" : "framed"} accent="duell" className="p-3">
            <p className="mb-2 text-sm font-semibold">Team B</p>
            <ul className="space-y-1 text-sm">
              {fightersB.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          </Card>
        </div>
        <Card variant="framed" accent="duell" className="p-4">
          <p className="mb-2 font-semibold text-sm">Stat-Vergleich (Teamsumme)</p>
          <StatBars statsA={sumStats(fightersA)} statsB={sumStats(fightersB)} />
        </Card>
        <Card variant="framed" accent="duell" className="p-4">
          <p className="mb-2 font-semibold">Kampfverlauf</p>
          <AnimatedBattleLog battle={battle} />
        </Card>
        <div className="flex flex-wrap gap-3">
          <Button onClick={rematch}>🔁 Gleiche Teams nochmal</Button>
          <Button variant="secondary" onClick={reset}>
            Neues Duell
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
