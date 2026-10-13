"use client";

import { useEffect, useState } from "react";
import { characters } from "@/lib/characters";

const SEEN_KEY = "op-imu-intro-seen";

// Short, deliberately vague flavor text (Q166) — Imu's whole in-universe
// identity is "a figure nobody is allowed to know about", so the intro
// leans into that rather than explaining who/what Imu actually is.
const LINES = [
  "Ein Name, den niemand aussprechen darf.",
  "Ein Gesicht, das niemand sehen durfte — bis jetzt.",
  "Selbst die Weltregierung kniet vor diesem Thron.",
  "Wer sich in den Weg stellt, schreibt damit sein eigenes Ende.",
];

export function hasSeenImuIntro(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markImuIntroSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // ignore
  }
}

export function ImuIntro({ onDone }: { onDone: () => void }) {
  const [lineIndex, setLineIndex] = useState(0);
  const imu = characters.find((c) => c.id === "imu");
  const allLinesShown = lineIndex >= LINES.length - 1;

  useEffect(() => {
    if (allLinesShown) return;
    const t = setTimeout(() => setLineIndex((i) => i + 1), 1800);
    return () => clearTimeout(t);
  }, [allLinesShown]);

  function dismiss() {
    markImuIntroSeen();
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black px-6 text-center">
      {imu?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imu.imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="op-pop-in h-40 w-auto rounded-lg opacity-80 grayscale"
        />
      )}
      <div className="flex max-w-md flex-col gap-3 font-[family-name:var(--font-mystery)] text-lg text-mode-imu">
        {LINES.slice(0, lineIndex + 1).map((line, i) => (
          <p key={i} className="op-pop-in">
            {line}
          </p>
        ))}
      </div>
      <button
        onClick={dismiss}
        className="mt-4 rounded-md border border-mode-imu/50 px-5 py-2 text-sm text-mode-imu transition hover:bg-mode-imu/10"
      >
        {allLinesShown ? "Ihm gegenübertreten" : "Überspringen"}
      </button>
    </div>
  );
}
