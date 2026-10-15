"use client";

import { useEffect, useState } from "react";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { playLose, playWin, vibrate } from "@/lib/sfx";

type Props = {
  won: boolean | null; // null = neutral/multi-way result, just show "Kampf beendet"
  label?: string;
};

const CONFETTI_COLORS = ["#f0b429", "#e11d48", "#059669", "#2563eb", "#9333ea", "#f97316"];

function makeConfetti() {
  return Array.from({ length: 18 }, (_, i) => ({
    key: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rotate: Math.random() * 360,
  }));
}

export function VictoryBanner({ won, label }: Props) {
  const [visible, setVisible] = useState(true);
  const [animationsEnabled] = useAnimationsEnabled();
  const [confetti] = useState(() => (won === true ? makeConfetti() : []));

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
  const color = won === true ? "text-emerald-950" : "text-rose-50";
  const bannerSrc = won === true ? "/live-draft/victory-banner.png" : "/live-draft/defeat-banner.png";

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
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40">
      {animationsEnabled &&
        confetti.map((c) => (
          <span
            key={c.key}
            className="op-confetti"
            style={{
              left: `${c.left}%`,
              backgroundColor: c.color,
              animationDelay: `${c.delay}s`,
              transform: `rotate(${c.rotate}deg)`,
            }}
          />
        ))}
      <div className="op-banner-in relative flex w-full max-w-xl items-center justify-center px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bannerSrc} alt="" className="absolute inset-0 h-auto w-full select-none" draggable={false} />
        <p
          className={`relative font-[family-name:var(--font-display)] text-4xl sm:text-5xl ${color}`}
          style={{ textShadow: inkTextShadow }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
