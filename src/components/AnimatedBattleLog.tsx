"use client";

import { useEffect, useRef, useState } from "react";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { playTick } from "@/lib/sfx";
import type { BattleResult } from "@/lib/battle-sim";

type Props = {
  battle: BattleResult;
};

const STEP_MS = 280;

export function AnimatedBattleLog({ battle }: Props) {
  const [animationsEnabled] = useAnimationsEnabled();
  const [shown, setShown] = useState(() => (animationsEnabled ? 0 : battle.rounds.length));
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animationsEnabled || shown >= battle.rounds.length) return;
    const id = setTimeout(() => {
      setShown((s) => s + 1);
      playTick();
    }, STEP_MS);
    return () => clearTimeout(id);
  }, [shown, animationsEnabled, battle.rounds.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [shown]);

  const visibleRounds = battle.rounds.slice(0, shown || battle.rounds.length);
  const isAnimating = animationsEnabled && shown < battle.rounds.length;

  return (
    <div>
      <div ref={scrollRef} className="max-h-48 overflow-y-auto text-xs font-mono space-y-0.5">
        {visibleRounds.map((r, i) => (
          <p key={i} className={animationsEnabled ? "op-round-in" : ""}>
            R{r.round}: {r.attackerName} → {r.defenderName} {r.critical ? "KRITISCH " : ""}
            -{r.damage} (HP danach: {r.defenderHpAfter})
          </p>
        ))}
      </div>
      {isAnimating && (
        <button
          onClick={() => setShown(battle.rounds.length)}
          className="mt-2 text-xs text-black/50 dark:text-white/40 hover:underline"
        >
          Überspringen →
        </button>
      )}
    </div>
  );
}
