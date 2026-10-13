import type { ReactNode } from "react";
import { MODE_ACCENT_CLASSES, type ModeAccent } from "./modeAccents";

type Props = {
  title: string;
  subtitle?: string;
  /** Tints the page title — pass the mode this page belongs to (Q29). */
  accent?: ModeAccent;
  maxWidthClassName?: string;
  children: ReactNode;
};

/**
 * Every page under src/app/*\/page.tsx used to repeat this exact
 * `<main>` + display-font `<h1>` + muted `<p>` structure verbatim (only the
 * max-width and copy differed) — this is that shared shell, pulled out into
 * one place so the per-mode accent color and heading styling live in one
 * component instead of 11 copies.
 */
export function PageShell({ title, subtitle, accent = "accent", maxWidthClassName = "max-w-4xl", children }: Props) {
  const a = MODE_ACCENT_CLASSES[accent];
  return (
    <main className={`mx-auto ${maxWidthClassName} px-4 py-8`}>
      <h1 className={`font-[family-name:var(--font-display)] text-3xl mb-1 ${a.text}`}>{title}</h1>
      {subtitle && <p className="text-sm text-black/60 dark:text-white/50 mb-6">{subtitle}</p>}
      {children}
    </main>
  );
}
