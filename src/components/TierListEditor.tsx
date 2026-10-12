"use client";

import { useEffect, useState } from "react";
import { characters, type Tier } from "@/lib/characters";
import { fetchMyTierLists, isSupabaseConfigured, saveTierListRemote } from "@/lib/supabase";
import { CharacterCard } from "./CharacterCard";

const TIERS: Tier[] = ["S", "A", "B", "C", "D"];
const STORAGE_KEY = "op-tierlists";

type Assignments = Record<string, Tier>;
type StoredLists = Record<string, Assignments>;
type PublicFlags = Record<string, boolean>;

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
  const [publicFlags, setPublicFlags] = useState<PublicFlags>({});
  const [assignments, setAssignments] = useState<Assignments>(
    () => allLists["Meine Tierliste"] ?? {}
  );
  const [compareWith, setCompareWith] = useState<string>("");
  const [syncState, setSyncState] = useState<"off" | "loading" | "synced" | "auth-error">(
    isSupabaseConfigured() ? "loading" : "off"
  );

  // One-time async fetch of this browser's remote tier lists, merged over
  // the local cache (remote wins on name clashes since it's the source of
  // truth once configured). This is a genuine network round-trip, not a
  // synchronous state mirror, so it belongs in an effect.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchMyTierLists().then(({ userId, lists: remoteLists }) => {
      if (cancelled) return;
      if (!userId) {
        setSyncState("auth-error");
        return;
      }
      setAllLists((prev) => {
        const merged = { ...prev };
        const flags: PublicFlags = {};
        for (const list of remoteLists) {
          merged[list.name] = list.assignments as Assignments;
          flags[list.name] = list.is_public;
        }
        setPublicFlags((prevFlags) => ({ ...prevFlags, ...flags }));
        if (merged[listName]) setAssignments(merged[listName]);
        return merged;
      });
      setSyncState("synced");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(nextAssignments: Assignments, nextPublic = publicFlags[listName] ?? false) {
    const next = { ...allLists, [listName]: nextAssignments };
    setAllLists(next);
    saveLists(next);
    if (isSupabaseConfigured()) {
      saveTierListRemote(listName, nextAssignments, nextPublic);
    }
  }

  function assign(characterId: string, tier: Tier) {
    const next = { ...assignments, [characterId]: tier };
    setAssignments(next);
    persist(next);
  }

  function togglePublic() {
    const nextPublic = !(publicFlags[listName] ?? false);
    setPublicFlags((prev) => ({ ...prev, [listName]: nextPublic }));
    persist(assignments, nextPublic);
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
        {isSupabaseConfigured() ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={publicFlags[listName] ?? false} onChange={togglePublic} />
            Öffentlich teilen (Freunde können diese Liste zum Vergleich sehen)
          </label>
        ) : (
          <p className="text-xs text-black/50 dark:text-white/40 max-w-xs">
            Listen werden aktuell nur in diesem Browser gespeichert. Für
            echten Vergleich mit Freunden auf anderen Geräten braucht es
            noch die Supabase-Anbindung (siehe .env.example).
          </p>
        )}
        <p className="text-xs text-black/40 dark:text-white/30">
          {syncState === "loading" && "Synchronisiere…"}
          {syncState === "synced" && "Synchronisiert ✓"}
          {syncState === "off" && "Nur lokal (Supabase nicht konfiguriert)"}
          {syncState === "auth-error" && (
            <span className="text-amber-600">
              Nur lokal – Supabase-Anmeldung fehlgeschlagen. Bitte in den
              Supabase-Projekteinstellungen unter Authentication → Sign In
              Methods &bdquo;Anonymous Sign-Ins&ldquo; aktivieren.
            </span>
          )}
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
