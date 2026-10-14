import type { HTMLAttributes } from "react";
import { MODE_ACCENT_CLASSES, type ModeAccent } from "./modeAccents";

type Variant = "plain" | "parchment" | "framed" | "spotlight";

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  /** Tints the border/gradient on the "spotlight" and "framed" variants. */
  accent?: ModeAccent;
};

/**
 * Codifies the card look that was previously either a bare `.op-card`/
 * `.op-parchment`/`.op-framed` className string, or — for the "spotlight"
 * look — a 6-class Tailwind string copy-pasted verbatim across Quiz, Crew
 * Builder, Fusion Builder and Blind Ranking.
 */
export function Card({ variant = "plain", accent = "accent", className = "", children, ...rest }: Props) {
  const a = MODE_ACCENT_CLASSES[accent];

  if (variant === "spotlight") {
    // Flat mode-tinted fill + a subtle mode-colored border + soft shadow
    // (toned down from the earlier hard ink shadow, 2026-10-14).
    return (
      <div
        className={`op-parchment rounded-xl border ${a.borderSoft} ${a.bgSoft} shadow-[0_2px_8px_rgba(0,0,0,0.15)] p-6 ${className}`}
        {...rest}
      >
        {children}
      </div>
    );
  }

  const base =
    variant === "plain"
      ? "op-card"
      : variant === "parchment"
        ? "op-card op-parchment"
        : "op-card op-parchment op-framed"; // framed

  return (
    <div className={`${base} ${className}`} {...rest}>
      {children}
    </div>
  );
}
