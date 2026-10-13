import type { RankableItem } from "@/lib/tierCategories";

type Props = {
  item: RankableItem;
  draggable?: boolean;
  onDragStart?: (itemId: string) => void;
};

export function RankItemCard({ item, draggable = false, onDragStart }: Props) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/rank-item-id", item.id);
        onDragStart?.(item.id);
      }}
      className={`op-card flex items-center gap-2 px-3 py-2 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-amber-500/50 ${
        draggable ? "cursor-grab" : ""
      }`}
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
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-700 dark:text-amber-400">
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
