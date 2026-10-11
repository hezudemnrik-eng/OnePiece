"use client";

import { useState } from "react";
import { characters, type Tier } from "@/lib/characters";
import { CharacterCard } from "./CharacterCard";

const TIERS: Tier[] = ["S", "A", "B", "C", "D"];
const STORAGE_KEY = "op-tierlists";

type Assignments = Record<string, Tier>;
type StoredLists = Record<string, Assignments>;

function loadLists(): StoredLists {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveLists(lists: StoredLists) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // ignore (private mode / storage disabled)
  }
}

export function TierListEditor() {
  const [listName, setListName] = useState("Meine Tierliste");
  const [allLists, setAllLists] = useState<StoredLists>(() => loadLists());
  const [assignments, setAssignments] = useState<Assignments>(
    () => allLists["Meine Tierliste"] ?? {}
  );
  const [compareWith, setCompareWith] = useState<string>("");

  function persist(nextAssignments: Assignments) {
    const next = { ...allLists, [listName]: nextAssignments };
    setAllLists(next);
    saveLists(next);
  }

  function assign(characterId: string, tier: Tier) {
    const next = { ...assignments, [characterId]: tier };
    setAssignments(next);
    persist(next);
  }

  function unassigned() {
    return characters.filter((c) => !assignments[c.id]);
  }

  const compareAssignments = compareWith ? allLists[compareWith] : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Listenname
          <input
            value={listName}
            onChange={(e) => {
              const name = e.target.value || "Meine Tierliste";
              setListName(name);
              setAssignments(allLists[name] ?? {});
            }}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Vergleichen mit
          <select
            value={compareWith}
            onChange={(e) => setCompareWith(e.target.value)}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          >
            <option value="">– keine –</option>
            {Object.keys(allLists)
              .filter((name) => name !== listName)
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
        </label>
        <p className="text-xs text-black/50 dark:text-white/40 max-w-xs">
          Listen werden aktuell nur in diesem Browser gespeichert. Für echten
          Vergleich mit Freunden auf anderen Geräten braucht es noch die
          Supabase-Anbindung (siehe .env.example).
        </p>
      </div>

      <div className="grid gap-3">
        {TIERS.map((tier) => (
          <div
            key={tier}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/character-id");
              if (id) assign(id, tier);
            }}
            className="flex items-start gap-3 rounded-lg border border-dashed border-black/15 dark:border-white/15 p-3 min-h-20"
          >
            <span className="w-8 shrink-0 text-center text-lg font-bold">
              {tier}
            </span>
            <div className="flex flex-wrap gap-2">
              {characters
                .filter((c) => assignments[c.id] === tier)
                .map((c) => (
                  <div key={c.id} className="relative">
                    <CharacterCard character={c} draggable onDragStart={() => {}} />
                    {compareAssignments && compareAssignments[c.id] && compareAssignments[c.id] !== tier && (
                      <span className="absolute -top-2 -right-2 rounded-full bg-fuchsia-600 text-white text-[10px] px-1.5 py-0.5">
                        dort: {compareAssignments[c.id]}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-black/60 dark:text-white/50">
          Noch nicht eingestuft – zieh einen Charakter in eine Tier-Reihe
        </h3>
        <div className="flex flex-wrap gap-2">
          {unassigned().map((c) => (
            <CharacterCard key={c.id} character={c} draggable onDragStart={() => {}} />
          ))}
        </div>
      </div>
    </div>
  );
}
