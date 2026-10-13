"use client";

import { useThemePreference, type ThemePreference } from "@/lib/theme";

const NEXT: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const ICON: Record<ThemePreference, string> = {
  system: "🖥️",
  light: "☀️",
  dark: "🌙",
};

const LABEL: Record<ThemePreference, string> = {
  system: "Design: Systemeinstellung (klicken für Hell)",
  light: "Design: Hell (klicken für Dunkel)",
  dark: "Design: Dunkel (klicken für Systemeinstellung)",
};

/** Manual light/dark override on top of the automatic system preference — cycles system → light → dark → system. */
export function ThemeToggle() {
  const [pref, setPref] = useThemePreference();
  return (
    <button onClick={() => setPref(NEXT[pref])} title={LABEL[pref]} aria-label={LABEL[pref]} className="text-base">
      {ICON[pref]}
    </button>
  );
}
