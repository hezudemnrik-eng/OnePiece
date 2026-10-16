"use client";

import type { ReactNode } from "react";
import { MODE_ACCENT_CLASSES, type ModeAccent } from "./modeAccents";
import { useFitScreen } from "@/lib/useFitScreen";

type Props = {
  title: string;
  subtitle?: string;
  /** Tints the page title — pass the mode this page belongs to (Q29). */
  accent?: ModeAccent;
  maxWidthClassName?: string;
  /** Shrinks the header (padding, title, subtitle) for a page whose body
   * needs every bit of vertical space it can get on a phone — the Fusion
   * Pirates board, where bigger pick cards took priority over header room. */
  compact?: boolean;
  /** Scales title+subtitle+children to fill the screen with zero scrolling,
   * the same mechanism Home uses (see useFitScreen) — for a nav page whose
   * tiles should grow to fill whatever room the device has (Boss, Q: Home
   * und andere Screens, 2026-10-16) instead of leaving dead space below a
   * short grid, or scrolling on a cramped one. */
  fit?: boolean;
  children: ReactNode;
};

/**
 * Every page under src/app/*\/page.tsx used to repeat this exact
 * `<main>` + display-font `<h1>` + muted `<p>` structure verbatim (only the
 * max-width and copy differed) — this is that shared shell, pulled out into
 * one place so the per-mode accent color and heading styling live in one
 * component instead of 11 copies.
 */
export function PageShell({
  title,
  subtitle,
  accent = "accent",
  maxWidthClassName = "max-w-4xl",
  compact = false,
  fit = false,
  children,
}: Props) {
  const a = MODE_ACCENT_CLASSES[accent];
  const { contentRef, fit: fitValues } = useFitScreen();
  const heading = (
    <>
      <h1
        className={`op-ink-text font-[family-name:var(--font-display)] ${
          compact ? "text-xl mb-0.5" : "text-3xl mb-1"
        } ${a.text}`}
      >
        {title}
      </h1>
      {subtitle && (
        <p className={`text-black/60 dark:text-white/50 ${compact ? "text-xs mb-2" : "text-sm mb-6"}`}>{subtitle}</p>
      )}
    </>
  );

  if (!fit) {
    return (
      <main className={`mx-auto ${maxWidthClassName} px-4 ${compact ? "py-3" : "py-8"}`}>
        {heading}
        {children}
      </main>
    );
  }

  return (
    <div style={fitValues.wrapperHeight != null ? { height: fitValues.wrapperHeight, overflow: "hidden" } : undefined}>
      <main
        ref={contentRef}
        style={{
          // See FitScreen.tsx / HomeOverview.tsx: left:50% + translateX(-50%)
          // in the same transform as the scale, not margin:auto — margin
          // centering on a percentage-width transformed element rendered
          // off-center on iOS even though every desktop browser showed it
          // dead-center.
          position: "relative",
          left: "50%",
          transform: `translateX(-50%) scale(${fitValues.scale})`,
          transformOrigin: "top center",
          width: `${fitValues.widthPct}%`,
        }}
        className={`${maxWidthClassName} px-4 ${compact ? "py-3" : "py-8"}`}
      >
        {heading}
        {children}
      </main>
    </div>
  );
}
