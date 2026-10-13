"use client";

import { useEffect, useState } from "react";

const KEY = "op-theme";

export type ThemePreference = "system" | "light" | "dark";

function read(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePreference) {
  if (pref === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", pref);
  }
}

/**
 * Manual light/dark override on top of the automatic system preference
 * (see globals.css: :root[data-theme] beats the prefers-color-scheme
 * media query). "system" clears the override and follows the OS again.
 */
export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
  const [pref, setPref] = useState<ThemePreference>(() => read());

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setPref(read());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function set(next: ThemePreference) {
    setPref(next);
    apply(next);
    try {
      if (next === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, next);
    } catch {
      // ignore
    }
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
  }

  return [pref, set];
}

/**
 * Inline bootstrap script (rendered in <head> by layout.tsx) that applies
 * the saved theme preference before first paint, so there's no flash of
 * the wrong theme while React hydrates.
 */
export const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var v = localStorage.getItem('${KEY}');
    if (v === 'light' || v === 'dark') document.documentElement.setAttribute('data-theme', v);
  } catch (e) {}
})();
`;
