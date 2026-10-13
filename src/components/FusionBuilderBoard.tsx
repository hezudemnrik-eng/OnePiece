"use client";

import { useState } from "react";
import {
  FUSION_CATEGORIES,
  rollFusionOption,
  type FusionCategoryId,
  type FusionOption,
} from "@/lib/fusionTraits";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";

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
}: {
  categoryLabel: string;
  option: FusionOption;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left disabled:cursor-default ${
        onClick
          ? "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/15 active:bg-amber-500/20"
          : "border-amber-500/30 bg-amber-500/5"
      }`}
    >
      {option.sourceImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={option.sourceImageUrl}
          alt={option.sourceName}
          referrerPolicy="no-referrer"
          className="h-10 w-10 shrink-0 rounded-full border border-amber-500/40 object-cover object-top"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-700 dark:text-amber-400">
          {option.sourceName.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          {categoryLabel}
        </p>
        <p className="truncate text-xs font-medium" title={option.traitLabel}>
          {option.traitLabel}
        </p>
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

  const remainingCategories = FUSION_CATEGORIES.filter(
    (c) => !picks.some((p) => p.categoryId === c.id)
  );

  function start() {
    setPhase("rolling");
    setPicks([]);
    setCandidates(rollCandidates(FUSION_CATEGORIES.map((c) => c.id)));
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
          die restlichen werden danach neu gewürfelt, bis dein Fusions-Pirat komplett ist.
        </p>
        <button
          onClick={start}
          className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
        >
          Fusion starten
        </button>
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
              <FusionTile
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
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h2 className="text-xl font-semibold">Dein Fusions-Pirat ist bereit!</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {FUSION_CATEGORIES.map((category) => {
          const pick = picks.find((p) => p.categoryId === category.id);
          if (!pick) return null;
          return <FusionTile key={category.id} categoryLabel={category.label} option={pick} />;
        })}
      </div>
      <button onClick={start} className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700">
        Neuen Fusions-Piraten würfeln
      </button>
    </div>
  );
}
