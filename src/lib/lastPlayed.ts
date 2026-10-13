"use client";

// Tracks the most recently opened game mode so the Home "Weiterspielen"
// tile (Q61/Q68) can jump straight back in. Client-only/local — no backend
// table for this, it's purely a per-browser convenience. Mirrors the
// read()-with-SSR-guard pattern used by lib/theme.ts and lib/animPrefs.ts.
const KEY = "op-last-mode-href";

export function getLastPlayedHref(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastPlayedHref(href: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, href);
  } catch {
    // ignore (private browsing, storage disabled, etc.)
  }
}
