"use client";

import type { Character, Role } from "@/lib/characters";
import { ASSIGNABLE_ROLES, roleFit } from "@/lib/crewRoles";

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
          Richtige Rolle = Stat-Bonus, falsche Rolle = Malus. &quot;Sonstige&quot; ist immer neutral. Jede Rolle nur einmal pro Team.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {roster.map((char) => {
          const assigned = assignments?.[char.id];
          return (
            <div key={char.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
              <div className="mb-2 flex items-center gap-2">
                {char.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={char.imageUrl}
                    alt={char.name}
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-full border border-black/10 object-cover object-top dark:border-white/10"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{char.name}</p>
                  <p className="text-xs text-black/50 dark:text-white/40">Natürliche Rolle: {char.role}</p>
                </div>
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
              {readOnly && assigned && <p className="text-xs text-amber-600">Zugeteilt: {assigned}</p>}
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <button
          onClick={onConfirm}
          className="self-start rounded-md bg-amber-600 px-5 py-2 font-medium text-white shadow transition hover:bg-amber-700 hover:shadow-md"
        >
          {confirmLabel}
        </button>
      )}
    </div>
  );
}
