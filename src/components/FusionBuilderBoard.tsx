"use client";

import { useState } from "react";
import {
  FUSION_CATEGORIES,
  computeBounty,
  formatBerry,
  rollFusionOption,
  type FusionCategoryId,
  type FusionOption,
} from "@/lib/fusionTraits";
import { checkFusionAchievements, type FusionAchievement } from "@/lib/fusionAchievements";
import { fusionXpForBounty, XP_ACHIEVEMENT_BONUS } from "@/lib/levels";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import { incrementXp, recordFusionCompletion, unlockAchievement } from "@/lib/supabase";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

type Phase = "setup" | "rolling" | "done";

function rollCandidates(categoryIds: FusionCategoryId[]): Record<FusionCategoryId, FusionOption> {
  const result = {} as Record<FusionCategoryId, FusionOption>;
  for (const id of categoryIds) {
    result[id] = rollFusionOption(id);
  }
  return result;
}

// Compact tile used both while picking and in the finished overview: small
// enough that all 7 categories fit on one phone screen at once without
// scrolling. Pass onClick to make it a tappable pick; omit it for a plain
// read-only tile (the finished result).
function FusionTile({
  categoryLabel,
  option,
  onClick,
  justLocked,
}: {
  categoryLabel: string;
  option: FusionOption;
  onClick?: () => void;
  /** Plays a short pop-in animation — used for a tile that was just locked in. */
  justLocked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left disabled:cursor-default ${
        onClick
          ? "border-mode-fusion/40 bg-mode-fusion/5 hover:bg-mode-fusion/15 active:bg-mode-fusion/20"
          : "border-mode-fusion/30 bg-mode-fusion/5"
      } ${justLocked ? "op-pop-in" : ""}`}
    >
      {option.sourceImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={option.sourceImageUrl}
          alt={option.sourceName}
          referrerPolicy="no-referrer"
          className="h-10 w-10 shrink-0 rounded-full border border-mode-fusion/40 object-cover object-top"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mode-fusion/15 text-xs font-bold text-mode-fusion">
          {option.sourceName.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-mode-fusion">
          {categoryLabel}
        </p>
        <p className="truncate text-xs font-medium" title={option.traitLabel}>
          {option.traitLabel}
        </p>
      </div>
    </button>
  );
}

// Bigger "wanted poster"-style pick card for the picking phase: large
// portrait, just the character's name — no stat text — so you recognize who
// you're picking by face, not by reading a trait description.
function FusionPickCard({
  categoryLabel,
  option,
  onClick,
}: {
  categoryLabel: string;
  option: FusionOption;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-mode-fusion/50 bg-gradient-to-b from-mode-fusion/10 to-transparent p-2 text-center shadow-sm hover:border-mode-fusion hover:bg-mode-fusion/15 active:bg-mode-fusion/20"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-mode-fusion">
        {categoryLabel}
      </span>
      {option.sourceImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={option.sourceImageUrl}
          alt={option.sourceName}
          referrerPolicy="no-referrer"
          className="h-20 w-20 rounded-full border-2 border-mode-fusion/50 object-cover object-top shadow-md"
        />
      ) : (
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-mode-fusion/15 text-xl font-bold text-mode-fusion">
          {option.sourceName.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="text-sm font-semibold leading-tight">{option.sourceName}</span>
    </button>
  );
}

export function FusionBuilderBoard() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [candidates, setCandidates] = useState<Record<FusionCategoryId, FusionOption>>(
    {} as Record<FusionCategoryId, FusionOption>
  );
  const [picks, setPicks] = useState<FusionOption[]>([]);
  const [newAchievements, setNewAchievements] = useState<FusionAchievement[]>([]);

  const remainingCategories = FUSION_CATEGORIES.filter(
    (c) => !picks.some((p) => p.categoryId === c.id)
  );

  function start() {
    setPhase("rolling");
    setPicks([]);
    setNewAchievements([]);
    setCandidates(rollCandidates(FUSION_CATEGORIES.map((c) => c.id)));
  }

  async function finalizeFusion(finalPicks: FusionOption[]) {
    const bounty = computeBounty(finalPicks);
    recordFusionCompletion(fusionXpForBounty(bounty));
    const earned = checkFusionAchievements(finalPicks, bounty);
    if (earned.length === 0) return;
    const results = await Promise.all(earned.map(async (a) => ({ a, isNew: await unlockAchievement(a.id) })));
    const fresh = results.filter((r) => r.isNew).map((r) => r.a);
    if (fresh.length > 0) {
      incrementXp(fresh.length * XP_ACHIEVEMENT_BONUS);
      setNewAchievements(fresh);
    }
  }

  function choose(categoryId: FusionCategoryId) {
    const chosen = candidates[categoryId];
    if (!chosen) return;
    playAccept();
    vibrate(25);
    const nextPicks = [...picks, chosen];
    setPicks(nextPicks);

    if (nextPicks.length === FUSION_CATEGORIES.length) {
      setPhase("done");
      setNewAchievements([]);
      finalizeFusion(nextPicks);
      return;
    }

    playSkip();
    vibrate(15);
    const stillOpenIds = remainingCategories.filter((c) => c.id !== categoryId).map((c) => c.id);
    setCandidates((prev) => ({ ...prev, ...rollCandidates(stillOpenIds) }));
  }

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <p className="text-sm text-black/60 dark:text-white/50">
          Alle {FUSION_CATEGORIES.length} Kategorien (
          {FUSION_CATEGORIES.map((c) => c.label).join(", ")}) liegen gleichzeitig aus. Wähle pro Runde eine davon —
          die restlichen werden danach neu gewürfelt. Am Ende bekommst du ein Kopfgeld für deinen Fusions-Piraten.
        </p>
        <Button onClick={start} className="self-start">
          Fusion starten
        </Button>
      </div>
    );
  }

  if (phase === "rolling") {
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        <div className="text-sm text-black/50 dark:text-white/40">
          Noch {remainingCategories.length} von {FUSION_CATEGORIES.length} Kategorien offen — antippen zum Wählen
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {remainingCategories.map((category) => {
            const candidate = candidates[category.id];
            if (!candidate) return null;
            return (
              <FusionPickCard
                key={category.id}
                categoryLabel={category.label}
                option={candidate}
                onClick={() => choose(category.id)}
              />
            );
          })}
        </div>
        {picks.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-black/60 dark:text-white/50">Schon festgelegt</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {picks.map((p) => (
                <FusionTile
                  key={p.categoryId}
                  categoryLabel={FUSION_CATEGORIES.find((c) => c.id === p.categoryId)?.label ?? ""}
                  option={p}
                  justLocked
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const bounty = computeBounty(picks);
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h2 className="font-[family-name:var(--font-display)] text-2xl text-mode-fusion">
        Dein Fusions-Pirat ist bereit!
      </h2>
      <Card variant="spotlight" accent="fusion" className="text-center">
        <p className="text-xs uppercase tracking-widest text-black/50 dark:text-white/40 mb-1">Kopfgeld</p>
        <p className="text-2xl font-bold text-mode-fusion">{formatBerry(bounty)}</p>
      </Card>
      {newAchievements.length > 0 && (
        <div className="op-pop-in rounded-xl border border-mode-fusion bg-mode-fusion/10 p-3">
          <p className="mb-1 text-sm font-semibold text-mode-fusion">🏆 Neue Erfolge freigeschaltet!</p>
          <ul className="flex flex-col gap-0.5 text-xs text-black/70 dark:text-white/60">
            {newAchievements.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.label}</span> — {a.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {FUSION_CATEGORIES.map((category) => {
          const pick = picks.find((p) => p.categoryId === category.id);
          if (!pick) return null;
          return <FusionTile key={category.id} categoryLabel={category.label} option={pick} justLocked />;
        })}
      </div>
      <Button onClick={start} className="self-start">
        Neuen Fusions-Piraten würfeln
      </Button>
    </div>
  );
}
