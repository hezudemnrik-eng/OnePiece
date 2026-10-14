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

type Phase = "setup" | "rolling" | "done";

function rollCandidates(categoryIds: FusionCategoryId[]): Record<FusionCategoryId, FusionOption> {
  const result = {} as Record<FusionCategoryId, FusionOption>;
  for (const id of categoryIds) {
    result[id] = rollFusionOption(id);
  }
  return result;
}

// "Wanted poster"-style grid card for the picking phase: full-bleed
// portrait, just the character's name — no stat text — so you recognize
// who you're picking by face, not by reading a trait description. One
// fixed-order grid tile per category (locked or still open) keeps the
// whole 7-category board at a constant size with no separate "already
// picked" section, so it fits one phone screen without scrolling.
function FusionGridCard({
  categoryLabel,
  option,
  locked,
  onClick,
}: {
  categoryLabel: string;
  option: FusionOption;
  /** Already chosen this round — shown read-only with a checkmark instead of tappable. */
  locked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`op-wanted relative aspect-[3/4] w-full overflow-hidden rounded-lg p-0 text-center transition disabled:cursor-default ${
        onClick ? "hover:brightness-95 active:brightness-90" : "opacity-75"
      } ${locked ? "op-pop-in" : ""}`}
    >
      <span className="absolute left-1 top-1 z-10 rounded bg-black/55 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
        {categoryLabel}
      </span>
      {locked && (
        <span className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-mode-fusion text-[10px] font-bold text-white">
          ✓
        </span>
      )}
      {option.sourceImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={option.sourceImageUrl}
          alt={option.sourceName}
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-mode-fusion/15 text-2xl font-bold">
          {option.sourceName.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 via-black/45 to-transparent px-1 pb-1 pt-4 font-[family-name:var(--font-display)] text-[11px] leading-tight text-white">
        {option.sourceName}
      </span>
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
      <div className="flex flex-col gap-2 max-w-2xl">
        <div className="text-xs text-black/50 dark:text-white/40">
          Noch {remainingCategories.length} von {FUSION_CATEGORIES.length} offen — antippen zum Wählen
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-1.5">
          {FUSION_CATEGORIES.map((category) => {
            const pick = picks.find((p) => p.categoryId === category.id);
            if (pick) {
              return <FusionGridCard key={category.id} categoryLabel={category.label} option={pick} locked />;
            }
            const candidate = candidates[category.id];
            if (!candidate) return null;
            return (
              <FusionGridCard
                key={category.id}
                categoryLabel={category.label}
                option={candidate}
                onClick={() => choose(category.id)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const bounty = computeBounty(picks);
  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      <h2 className="op-ink-text font-[family-name:var(--font-display)] text-xl text-mode-fusion">
        Dein Fusions-Pirat ist bereit!
      </h2>
      <div className="op-wanted op-parchment op-legendary-glow op-bounty-reveal rounded-xl p-5 text-center">
        <p className="op-slide-in text-xs uppercase tracking-[0.4em] opacity-70">Gesucht — Kopfgeld</p>
        <p className="op-bounty-number font-[family-name:var(--font-display)] text-4xl sm:text-5xl">
          {formatBerry(bounty)}
        </p>
      </div>
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
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-1.5">
        {FUSION_CATEGORIES.map((category) => {
          const pick = picks.find((p) => p.categoryId === category.id);
          if (!pick) return null;
          return <FusionGridCard key={category.id} categoryLabel={category.label} option={pick} locked />;
        })}
      </div>
      <Button onClick={start} className="self-start">
        Neuen Fusions-Piraten würfeln
      </Button>
    </div>
  );
}
