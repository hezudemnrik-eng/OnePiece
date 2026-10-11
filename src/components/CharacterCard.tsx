import type { Character } from "@/lib/characters";

const TIER_COLORS: Record<Character["tier"], string> = {
  S: "bg-amber-500 text-amber-950",
  A: "bg-rose-500 text-rose-950",
  B: "bg-sky-500 text-sky-950",
  C: "bg-emerald-500 text-emerald-950",
  D: "bg-zinc-400 text-zinc-950",
};

type Props = {
  character: Character;
  draggable?: boolean;
  onDragStart?: (characterId: string) => void;
  onClick?: (characterId: string) => void;
  selected?: boolean;
};

export function CharacterCard({
  character,
  draggable = false,
  onDragStart,
  onClick,
  selected = false,
}: Props) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/character-id", character.id);
        onDragStart?.(character.id);
      }}
      onClick={() => onClick?.(character.id)}
      className={`flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm shadow-sm transition hover:shadow-md ${
        onClick ? "cursor-pointer" : draggable ? "cursor-grab" : ""
      } ${selected ? "ring-2 ring-amber-500" : ""}`}
    >
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${TIER_COLORS[character.tier]}`}
      >
        {character.tier}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium">{character.name}</p>
        <p className="truncate text-xs text-black/60 dark:text-white/50">
          {character.crew} · {character.role}
        </p>
      </div>
    </div>
  );
}
