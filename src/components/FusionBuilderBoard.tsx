"use client";

import { useEffect, useState } from "react";
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
import { modeUpgradeBonusPercent } from "@/lib/modeUpgrades";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import { fetchMyModeUpgradeLevels, incrementXp, recordFusionCompletion, unlockAchievement } from "@/lib/supabase";
import { Button } from "./ui/Button";

type Phase = "setup" | "rolling" | "done";

function rollCandidates(
  categoryIds: FusionCategoryId[],
  goodTierBonusPercent: number
): Record<FusionCategoryId, FusionOption> {
  const result = {} as Record<FusionCategoryId, FusionOption>;
  for (const id of categoryIds) {
    result[id] = rollFusionOption(id, Math.random, goodTierBonusPercent);
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
      className={`op-wanted relative aspect-[1/2] w-full overflow-hidden rounded-lg p-0 text-center transition disabled:cursor-default ${
        onClick ? "hover:brightness-95 active:brightness-90" : "opacity-75"
      } ${locked ? "op-pop-in" : ""}`}
    >
      <span className="absolute left-1 top-1 z-10 max-w-[calc(100%-0.5rem)] truncate rounded bg-black/55 px-1 py-0.5 text-[8px] font-semibold uppercase text-white">
        {categoryLabel}
      </span>
      {locked && (
        <span className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-mode-fusion text-xs font-bold text-white">
          ✓
        </span>
      )}
      {/* Keyed by the rolled character so a reroll (new candidate while the
          category is still open) remounts this wrapper and replays the
          op-pop-in flip — the card visibly "spins" to the new face instead
          of just swapping the image in place. */}
      <div
        key={`${option.sourceCharacterId}-${option.traitLabel}`}
        className={`absolute inset-0 ${onClick ? "op-pop-in" : ""}`}
      >
        {option.sourceImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={option.sourceImageUrl}
            alt={option.sourceName}
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-mode-fusion/15 text-3xl font-bold">
            {option.sourceName.slice(0, 2).toUpperCase()}
          </span>
        )}
        {/* Full name, wrapped to up to 2 lines instead of single-line
            ellipsis — FitScreen (Q106/#108) narrows this grid's layout
            width whenever it scales the page, which made a one-line
            truncate cut off longer names (e.g. "Bartholomew…") much more
            often than before. line-clamp keeps it to 2 lines so longer
            names stay readable without the card growing unbounded. */}
        <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-1.5 pb-1 pt-5 font-[family-name:var(--font-display)] text-[11px] leading-tight text-white">
          {option.sourceName}
        </span>
      </div>
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
  // The Fusion mode-upgrade (migration 0023) no longer boosts XP/Berry —
  // it only biases this roll toward S/A-tier characters (Boss, 2026-10-14).
  const [goodTierBonusPercent, setGoodTierBonusPercent] = useState(0);

  useEffect(() => {
    fetchMyModeUpgradeLevels().then((levels) => {
      setGoodTierBonusPercent(modeUpgradeBonusPercent(levels.fusion ?? 0));
    });
  }, []);

  const remainingCategories = FUSION_CATEGORIES.filter(
    (c) => !picks.some((p) => p.categoryId === c.id)
  );

  function start() {
    setPhase("rolling");
    setPicks([]);
    setNewAchievements([]);
    setCandidates(rollCandidates(FUSION_CATEGORIES.map((c) => c.id), goodTierBonusPercent));
  }

  async function finalizeFusion(finalPicks: FusionOption[]) {
    const bounty = computeBounty(finalPicks);
    recordFusionCompletion(fusionXpForBounty(bounty), bounty);
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
    setCandidates((prev) => ({ ...prev, ...rollCandidates(stillOpenIds, goodTierBonusPercent) }));
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
      <div className="flex flex-col gap-1 max-w-2xl">
        <div className="text-[11px] text-black/50 dark:text-white/40">
          Noch {remainingCategories.length} von {FUSION_CATEGORIES.length} offen — antippen zum Wählen
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-1">
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
    <div className="flex flex-col gap-2 max-w-2xl">
      <h2 className="op-ink-text font-[family-name:var(--font-display)] text-lg text-mode-fusion">
        Dein Fusions-Pirat ist bereit!
      </h2>
      <div className="op-wanted op-parchment op-legendary-glow op-bounty-reveal rounded-xl p-4 text-center">
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
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-1">
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
