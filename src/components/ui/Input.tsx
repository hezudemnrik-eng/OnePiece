import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

/** Replaces the repeated `rounded-md border ... bg-white/70 dark:bg-white/5 px-3 py-1.5` string. */
export function Input({ className = "", ...rest }: Props) {
  return (
    <input
      className={`rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5 outline-none focus:border-accent/60 ${className}`}
      {...rest}
    />
  );
}
