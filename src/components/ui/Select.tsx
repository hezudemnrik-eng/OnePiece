import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

/** Select counterpart to Input — same field chrome, same focus ring. */
export function Select({ className = "", ...rest }: Props) {
  return (
    <select
      className={`rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5 outline-none focus:border-accent/60 ${className}`}
      {...rest}
    />
  );
}
