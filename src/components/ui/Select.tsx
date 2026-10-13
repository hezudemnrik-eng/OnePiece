import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

/** Select counterpart to Input — same field chrome, same focus ring. */
export function Select({ className = "", ...rest }: Props) {
  return (
    <select
      className={`rounded-md border-2 border-foreground bg-white/70 dark:bg-white/5 px-3 py-1.5 outline-none focus:border-accent ${className}`}
      {...rest}
    />
  );
}
