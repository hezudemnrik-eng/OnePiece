"use client";

import type { Character, Role } from "@/lib/characters";
import { ASSIGNABLE_ROLES, roleFit } from "@/lib/crewRoles";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

type Props = {
  roster: Character[];
  assignments: Record<string, Role> | undefined;
  onAssign: (characterId: string, role: Role) => void;
  onConfirm: () => void;
  confirmLabel?: string;
  readOnly?: boolean;
};

const FIT_STYLES: Record<string, string> = {
  match: "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  mismatch: "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  neutral: "border-black/15 dark:border-white/15",
};

export function RoleAssignmentPanel({ roster, assignments, onAssign, onConfirm, confirmLabel = "Kampf starten", readOnly = false }: Props) {
  const takenRoles = new Set(Object.values(assignments ?? {}));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold">Rollen zuteilen (optional)</p>
        <p className="text-xs text-black/60 dark:text-white/50">
          Richtige Rolle = Stat-Bonus, falsche Rolle = Malus. &quot;Sonstige&quot; ist immer neutral. Jede Rolle nur einmal pro Spieler.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {roster.map((char) => {
          const assigned = assignments?.[char.id];
          return (
            <div
              key={char.id}
              className="op-parchment flex flex-col gap-2 rounded-xl border border-mode-draft/30 bg-gradient-to-b from-mode-draft/10 to-transparent p-3"
            >
              <div className="flex items-center gap-2">
                {char.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={char.imageUrl}
                    alt={char.name}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-lg border border-mode-draft/30 object-cover object-top"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{char.name}</p>
                  <p className="truncate text-xs text-black/50 dark:text-white/40">Natürliche Rolle: {char.role}</p>
                </div>
                <Badge rarity={char.tier === "S" ? "legendary" : char.tier === "A" ? "gold" : undefined} className="ml-auto shrink-0">
                  {char.tier}
                </Badge>
              </div>
              {!readOnly && (
                <div className="flex flex-wrap gap-1.5">
                  {ASSIGNABLE_ROLES.map((role) => {
                    const isAssignedHere = assigned === role;
                    const isTakenByOther = takenRoles.has(role) && !isAssignedHere;
                    const fit = roleFit(char.role, role);
                    return (
                      <button
                        key={role}
                        type="button"
                        disabled={isTakenByOther}
                        onClick={() => onAssign(char.id, role)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${
                          isAssignedHere ? FIT_STYLES[fit] + " ring-2 ring-offset-1 ring-current" : FIT_STYLES[fit]
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              )}
              {readOnly && assigned && <p className="text-xs text-mode-draft">Zugeteilt: {assigned}</p>}
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <Button onClick={onConfirm} className="self-start">
          {confirmLabel}
        </Button>
      )}
    </div>
  );
}
