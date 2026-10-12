import type { Character } from "@/lib/characters";
import { CharacterCard } from "./CharacterCard";

type Props = {
  character: Character | null;
  skipsLeft: number;
  onAccept: () => void;
  onSkip: () => void;
  /** True when it isn't this viewer's turn (live draft) — shows the roll read-only. */
  readOnly?: boolean;
};

export function RollPanel({ character, skipsLeft, onAccept, onSkip, readOnly = false }: Props) {
  if (!character) return null;
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-6">
      <p className="text-sm text-black/60 dark:text-white/50">
        {readOnly ? "Gerade gerollt" : "Dein gerollter Charakter"}
      </p>
      <div className="w-full max-w-xs">
        <CharacterCard character={character} />
      </div>
      {!readOnly && (
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            className="rounded-md bg-amber-600 text-white px-5 py-2 font-medium hover:bg-amber-700"
          >
            Nehmen
          </button>
          <button
            onClick={onSkip}
            disabled={skipsLeft <= 0}
            className="rounded-md border border-black/15 dark:border-white/15 px-5 py-2 font-medium disabled:opacity-40"
          >
            Skip ({skipsLeft} übrig)
          </button>
        </div>
      )}
    </div>
  );
}
