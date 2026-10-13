import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-white hover:brightness-90 disabled:hover:brightness-100",
  secondary:
    "border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5",
  danger: "bg-danger text-white hover:brightness-90 disabled:hover:brightness-100",
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
