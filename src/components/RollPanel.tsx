"use client";

import { useEffect, useRef, useState } from "react";
import { characters, type Character } from "@/lib/characters";
import { classifyFruit, FRUIT_COLORS } from "@/lib/fruitType";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { playTick } from "@/lib/sfx";
import { CharacterCard } from "./CharacterCard";

type Props = {
  character: Character | null;
  skipsLeft: number;
  onAccept: () => void;
  onSkip: () => void;
  /** True when it isn't this viewer's turn (live draft) — shows the roll read-only. */
  readOnly?: boolean;
};

// Slot-machine deceleration curve: short gaps at first, stretching out
// before landing on the real roll — ~1.4s total.
const SPIN_DELAYS = [60, 60, 70, 80, 90, 110, 130, 160, 190, 230, 280];

export function RollPanel({ character, skipsLeft, onAccept, onSkip, readOnly = false }: Props) {
  const [animationsEnabled] = useAnimationsEnabled();
  const [spinning, setSpinning] = useState(false);
  const [spinFrame, setSpinFrame] = useState<Character | null>(null);
  const lastIdRef = useRef<string | null>(character?.id ?? null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Render-time derivation, not state synced from a prop: while spinning,
  // show the cycling frame; otherwise the real roll is already the value
  // to render, no effect needed to mirror it into state.
  const displayed = spinning && spinFrame ? spinFrame : character;

  useEffect(() => {
    if (!character) return;
    const changed = character.id !== lastIdRef.current;
    lastIdRef.current = character.id;
    if (!changed || !animationsEnabled) return;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const spinTimer = setTimeout(() => setSpinning(true), 0);
    timersRef.current.push(spinTimer);

    let elapsed = 0;
    SPIN_DELAYS.forEach((delay) => {
      elapsed += delay;
      const t = setTimeout(() => {
        setSpinFrame(characters[Math.floor(Math.random() * characters.length)]);
      }, elapsed);
      timersRef.current.push(t);
    });
    const finalT = setTimeout(() => {
      setSpinning(false);
      setSpinFrame(null);
      playTick();
    }, elapsed + 90);
    timersRef.current.push(finalT);

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id, animationsEnabled]);

  if (!displayed) return null;

  const isSTier = !spinning && displayed.tier === "S";
  const fruitClass = !spinning ? classifyFruit(displayed.devilFruit) : null;
  const fruitColor = fruitClass ? FRUIT_COLORS[fruitClass] : undefined;

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent p-6 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
        {spinning ? "Rollt…" : readOnly ? "Gerade gerollt" : "Dein gerollter Charakter"}
      </p>
      {displayed.imageUrl && (
        <div
          className={`rounded-xl ${!spinning ? "op-pop-in" : ""} ${isSTier ? "op-s-tier-glow" : ""}`}
          style={fruitColor ? { boxShadow: `0 0 0 3px ${fruitColor}55` } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayed.imageUrl}
            alt={spinning ? "" : displayed.name}
            referrerPolicy="no-referrer"
            className={`h-44 w-auto rounded-xl border object-cover object-top shadow-lg transition-opacity ${spinning ? "opacity-70 blur-[1px]" : "opacity-100"}`}
            style={{ borderColor: fruitColor ?? "rgba(245, 158, 11, 0.3)" }}
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
      <div className="w-full max-w-xs">
        <CharacterCard character={displayed} />
      </div>
      {!readOnly && (
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            disabled={spinning}
            className="rounded-md bg-amber-600 text-white px-5 py-2 font-medium shadow transition hover:bg-amber-700 hover:shadow-md disabled:opacity-40"
          >
            Nehmen
          </button>
          <button
            onClick={onSkip}
            disabled={spinning || skipsLeft <= 0}
            className="rounded-md border border-black/15 dark:border-white/15 px-5 py-2 font-medium transition hover:border-amber-500/50 disabled:opacity-40"
          >
            Skip ({skipsLeft} übrig)
          </button>
        </div>
      )}
    </div>
  );
}
