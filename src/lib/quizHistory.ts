"use client";

// Cross-session "don't repeat the same question again right away" (Q121).
// Caps how many ids we remember so this never grows unbounded — once full,
// the oldest remembered ids age out first (FIFO), so very old questions
// become fair game again instead of being excluded forever.
const KEY = "op-quiz-seen-question-ids";
const MAX_REMEMBERED = 400;

export function loadSeenQuestionIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw: string[] = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return new Set(raw);
  } catch {
    return new Set();
  }
}

export function rememberQuestionIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const existing: string[] = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    const merged = [...existing.filter((id) => !ids.includes(id)), ...ids].slice(-MAX_REMEMBERED);
    window.localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
}
