import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

/** Replaces the repeated `rounded-md border ... bg-white/70 dark:bg-white/5 px-3 py-1.5` string. */
export function Input({ className = "", ...rest }: Props) {
  return (
    <input
      className={`rounded-md border border-foreground/35 bg-white/70 dark:bg-white/5 px-3 py-1.5 outline-none focus:border-accent ${className}`}
      {...rest}
    />
  );
}
