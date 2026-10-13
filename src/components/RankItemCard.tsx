import type { RankableItem } from "@/lib/tierCategories";
import { Badge } from "./ui/Badge";

const TIER_RARITY: Record<string, "legendary" | "gold" | "silver" | "bronze"> = {
  S: "legendary",
  A: "gold",
  B: "silver",
  C: "bronze",
  D: "bronze",
};

type Props = {
  item: RankableItem;
  draggable?: boolean;
  onDragStart?: (itemId: string) => void;
  /** Tap-to-assign alternative to drag & drop (no native DnD on touch devices). */
  onClick?: (itemId: string) => void;
  selected?: boolean;
};

export function RankItemCard({ item, draggable = false, onDragStart, onClick, selected }: Props) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/rank-item-id", item.id);
        onDragStart?.(item.id);
      }}
      onClick={onClick ? () => onClick(item.id) : undefined}
      className={`op-card flex items-center gap-2 px-3 py-2 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-mode-tierlisten/50 ${
        draggable ? "cursor-grab" : ""
      } ${onClick ? "cursor-pointer" : ""} ${selected ? "ring-2 ring-mode-tierlisten" : ""}`}
    >
      <div className="relative shrink-0">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-10 w-10 rounded-full object-cover object-top border-2 border-foreground"
          />
        ) : (
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-foreground bg-mode-tierlisten/15 text-xs font-bold text-mode-tierlisten">
            {item.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        {item.tier && (
          <Badge rarity={TIER_RARITY[item.tier]} size="sm" className="absolute -bottom-1 -right-1">
            {item.tier}
          </Badge>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{item.name}</p>
        {item.subtitle && <p className="truncate text-xs text-black/60 dark:text-white/50">{item.subtitle}</p>}
      </div>
    </div>
  );
}
