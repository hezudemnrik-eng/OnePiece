import type { Character } from "@/lib/characters";
import { Badge } from "./ui/Badge";

const TIER_RARITY: Record<Character["tier"], "legendary" | "gold" | "silver" | "bronze"> = {
  S: "legendary",
  A: "gold",
  B: "silver",
  C: "bronze",
  D: "bronze",
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
      className={`flex items-center gap-2 px-1 py-1 text-sm transition ${
        onClick ? "cursor-pointer" : draggable ? "cursor-grab" : ""
      } ${selected ? "ring-2 ring-poster-ink rounded-lg" : ""}`}
    >
      <div className="relative shrink-0">
        {character.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={character.imageUrl}
            alt={character.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-10 w-10 rounded-full object-cover object-top border-2 border-poster-ink"
          />
        ) : (
          <Badge rarity={TIER_RARITY[character.tier]}>{character.tier}</Badge>
        )}
        {character.imageUrl && (
          <Badge rarity={TIER_RARITY[character.tier]} size="sm" className="absolute -bottom-1 -right-1">
            {character.tier}
          </Badge>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-[family-name:var(--font-display)] text-base">{character.name}</p>
        <p className="truncate text-xs opacity-70">
          {character.crew} · {character.role}
        </p>
      </div>
    </div>
  );
}
