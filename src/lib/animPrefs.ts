"use client";

import { useEffect, useState } from "react";

const KEY = "op-animations-enabled";

function read(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

/** Shared on/off switch for roll animations, sound effects and vibration. */
export function useAnimationsEnabled(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState(() => read());

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setEnabled(read());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function set(next: boolean) {
    setEnabled(next);
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
    // Same-tab listeners (storage events don't fire in the tab that wrote).
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
  }

  return [enabled, set];
}
