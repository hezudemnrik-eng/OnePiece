import type { RankableItem } from "@/lib/tierCategories";

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
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-10 w-10 shrink-0 rounded-full object-cover object-top border border-black/10 dark:border-white/10"
        />
      ) : (
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mode-tierlisten/15 text-xs font-bold text-mode-tierlisten">
          {item.name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-medium">{item.name}</p>
        {item.subtitle && <p className="truncate text-xs text-black/60 dark:text-white/50">{item.subtitle}</p>}
      </div>
    </div>
  );
}
