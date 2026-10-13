import type { HTMLAttributes } from "react";

type Rarity = "bronze" | "silver" | "gold" | "legendary";
type Size = "sm" | "md";

type Props = HTMLAttributes<HTMLSpanElement> & {
  rarity?: Rarity;
  size?: Size;
};

const RARITY_CLASSES: Record<Rarity, string> = {
  bronze: "bg-rarity-bronze text-white",
  silver: "bg-rarity-silver text-black",
  gold: "bg-rarity-gold text-black",
  legendary: "op-legendary-glow bg-rarity-legendary text-white",
};

// Two fixed sizes rather than a className override — conflicting Tailwind
// size utilities (e.g. a caller passing "h-5 w-5" after our own "h-7 w-7")
// don't reliably override each other via class string order.
const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-5 w-5 text-[10px] border",
  md: "h-7 w-7 text-xs border-2",
};

/**
 * Wax-seal/medallion-style tier badge (Phase 12, from the wanted-poster
 * reference mockups) — a small circular coin with a bold ink ring and a
 * lighter inner ring, replacing the earlier flat rounded pill. Sized for a
 * single tier letter; for longer labels pass a wider className override.
 */
export function Badge({ rarity, size = "md", className = "", children, ...rest }: Props) {
  const rarityClass = rarity ? RARITY_CLASSES[rarity] : "bg-black/10 dark:bg-white/10";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-foreground font-bold uppercase shadow-[0_0_0_2px_var(--poster-paper)] ${SIZE_CLASSES[size]} ${rarityClass} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
