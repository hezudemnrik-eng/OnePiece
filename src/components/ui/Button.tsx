import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "op-ink-btn bg-accent text-white hover:brightness-95 disabled:hover:brightness-100",
  secondary: "op-ink-btn bg-transparent hover:bg-black/5 dark:hover:bg-white/5",
  danger: "op-ink-btn bg-danger text-white hover:brightness-95 disabled:hover:brightness-100",
  // Deliberately left plain (no ink border) — minor/de-emphasized actions
  // like "Zurück" or "Abbrechen" shouldn't compete visually with real buttons.
  ghost: "hover:bg-black/5 dark:hover:bg-white/5",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2",
};

/**
 * Shared primary/secondary/danger button. Replaces the hand-copied
 * `rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700`
 * (and its outline/secondary counterpart) that used to be repeated verbatim
 * across every board component.
 */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    />
  );
}
