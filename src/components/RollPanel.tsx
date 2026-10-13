"use client";

import { useEffect, useRef, useState } from "react";
import { characters, type Character } from "@/lib/characters";
import { classifyFruit, FRUIT_COLORS } from "@/lib/fruitType";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { playTick } from "@/lib/sfx";
import { CharacterCard } from "./CharacterCard";
import { Button } from "./ui/Button";

type Props = {
  offered: Character[];
  skipsLeft: number;
  onPick: (characterId: string) => void;
  onSkip: () => void;
  /** True when it isn't this viewer's turn (live draft) — shows the offer read-only. */
  readOnly?: boolean;
};

// Slot-machine deceleration curve: short gaps at first, stretching out
// before landing on the real offer — ~1.4s total.
const SPIN_DELAYS = [60, 60, 70, 80, 90, 110, 130, 160, 190, 230, 280];

function randomCharacter(): Character {
  return characters[Math.floor(Math.random() * characters.length)];
}

export function RollPanel({ offered, skipsLeft, onPick, onSkip, readOnly = false }: Props) {
  const [animationsEnabled] = useAnimationsEnabled();
  const [spinning, setSpinning] = useState(false);
  const [spinFrames, setSpinFrames] = useState<Character[]>([]);
  const offeredKey = offered.map((c) => c.id).join(",");
  const lastKeyRef = useRef<string>(offeredKey);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Render-time derivation, not state synced from a prop: while spinning,
  // show the cycling frames; otherwise the real offer is already the value
  // to render, no effect needed to mirror it into state.
  const displayed = spinning && spinFrames.length === offered.length ? spinFrames : offered;

  useEffect(() => {
    if (offered.length === 0) return;
    const changed = offeredKey !== lastKeyRef.current;
    lastKeyRef.current = offeredKey;
    if (!changed || !animationsEnabled) return;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const spinTimer = setTimeout(() => setSpinning(true), 0);
    timersRef.current.push(spinTimer);

    let elapsed = 0;
    SPIN_DELAYS.forEach((delay) => {
      elapsed += delay;
      const t = setTimeout(() => {
        setSpinFrames(offered.map(() => randomCharacter()));
      }, elapsed);
      timersRef.current.push(t);
    });
    const finalT = setTimeout(() => {
      setSpinning(false);
      setSpinFrames([]);
      playTick();
    }, elapsed + 90);
    timersRef.current.push(finalT);

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeredKey, animationsEnabled]);

  if (displayed.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xs uppercase tracking-[0.2em] text-mode-draft">
        {spinning ? "Rollt…" : readOnly ? "Gerade angeboten" : "Wähle einen Charakter"}
      </p>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        {displayed.map((char, i) => {
          const isSTier = !spinning && char.tier === "S";
          const fruitClass = !spinning ? classifyFruit(char.devilFruit) : null;
          const fruitColor = fruitClass ? FRUIT_COLORS[fruitClass] : undefined;
          return (
            <div
              key={i}
              className="op-parchment op-ink flex flex-col items-center gap-3 rounded-2xl bg-mode-draft/10 p-4"
            >
              {char.imageUrl && (
                <div
                  className={`rounded-xl ${!spinning ? "op-pop-in" : ""} ${isSTier ? "op-s-tier-glow" : ""}`}
                  style={fruitColor ? { boxShadow: `0 0 0 3px ${fruitColor}55` } : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={char.imageUrl}
                    alt={spinning ? "" : char.name}
                    referrerPolicy="no-referrer"
                    className={`h-32 w-auto rounded-xl border object-cover object-top shadow-lg transition-opacity ${spinning ? "opacity-70 blur-[1px]" : "opacity-100"}`}
                    style={{ borderColor: fruitColor ?? "var(--mode-draft)" }}
                  />
                </div>
              )}
              {fruitClass && !spinning && (
                <span
                  className="-mt-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                  style={{ background: fruitColor }}
                >
                  {fruitClass}
                </span>
              )}
              <div className="w-full">
                <CharacterCard character={char} />
              </div>
              {!readOnly && (
                <Button onClick={() => onPick(char.id)} disabled={spinning} className="w-full shadow hover:shadow-md">
                  Wählen
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <Button variant="secondary" onClick={onSkip} disabled={spinning || skipsLeft <= 0} className="hover:border-mode-draft/50">
          Alle neu würfeln ({skipsLeft} übrig)
        </Button>
      )}
    </div>
  );
}
