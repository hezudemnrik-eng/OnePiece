import type { HTMLAttributes } from "react";

type Rarity = "bronze" | "silver" | "gold" | "legendary";

type Props = HTMLAttributes<HTMLSpanElement> & {
  rarity?: Rarity;
};

const RARITY_CLASSES: Record<Rarity, string> = {
  bronze: "bg-rarity-bronze text-white",
  silver: "bg-rarity-silver text-black",
  gold: "bg-rarity-gold text-black",
  legendary: "op-legendary-glow bg-rarity-legendary text-white",
};

/**
 * Small rounded pill — tier badges on CharacterCard/RankItemCard, rarity
 * chips, and the "Neu"-badge on freshly added characters (Q90) all use this
 * instead of hand-rolling their own `rounded-full ... text-[10px]` string.
 */
export function Badge({ rarity, className = "", children, ...rest }: Props) {
  const rarityClass = rarity ? RARITY_CLASSES[rarity] : "bg-black/10 dark:bg-white/10";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${rarityClass} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
