"use client";

import { useEffect, useState } from "react";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { playLose, playWin, vibrate } from "@/lib/sfx";

type Props = {
  won: boolean | null; // null = neutral/multi-way result, just show "Kampf beendet"
  label?: string;
};

export function VictoryBanner({ won, label }: Props) {
  const [visible, setVisible] = useState(true);
  const [animationsEnabled] = useAnimationsEnabled();

  useEffect(() => {
    if (animationsEnabled) {
      if (won === true) {
        playWin();
        vibrate([40, 60, 40]);
      } else if (won === false) {
        playLose();
        vibrate(120);
      }
    }
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const text = label ?? (won === true ? "SIEG!" : won === false ? "NIEDERLAGE" : "KAMPF BEENDET");
  const color = won === true ? "text-emerald-400" : won === false ? "text-rose-400" : "text-amber-300";

  // Comic-lettering stroke (4-direction outline) plus a bold offset shadow
  // for depth, instead of the earlier soft blurred drop-shadow (Phase 11).
  const inkTextShadow = [
    "-2px -2px 0 #000",
    "2px -2px 0 #000",
    "-2px 2px 0 #000",
    "2px 2px 0 #000",
    "7px 7px 0 rgba(0,0,0,0.85)",
  ].join(", ");

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <p
        className={`op-banner-in font-[family-name:var(--font-display)] text-6xl sm:text-7xl ${color}`}
        style={{ textShadow: inkTextShadow }}
      >
        {text}
      </p>
    </div>
  );
}
