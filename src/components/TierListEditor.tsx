"use client";

import { useEffect, useState } from "react";
import type { Tier } from "@/lib/characters";
import {
  ensureProfile,
  fetchMyTierLists,
  fetchPublicListsByShareCode,
  isSupabaseConfigured,
  saveTierListRemote,
} from "@/lib/supabase";
import {
  BUILT_IN_CATEGORIES,
  builtInCategory,
  createCustomCategory,
  loadCustomCategories,
  saveCustomCategories,
  type CustomCategory,
  type RankableItem,
} from "@/lib/tierCategories";
import { checkTierListAchievements, type TierListAchievement } from "@/lib/tierListAchievements";
import { XP_ACHIEVEMENT_BONUS } from "@/lib/levels";
import { incrementXp, unlockAchievement } from "@/lib/supabase";
import { RankItemCard } from "./RankItemCard";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";

const TIERS: Tier[] = ["S", "A", "B", "C", "D"];
const STORAGE_KEY = "op-tierlists";
const NICKNAME_KEY = "op-nickname";
const DEFAULT_LIST_NAME = "Meine Tierliste";

type Assignments = Record<string, Tier>;
/** Keyed by `${category}::${listName}`. */
type StoredLists = Record<string, Assignments>;
type PublicFlags = Record<string, boolean>;

function storageKey(category: string, name: string): string {
  return `${category}::${name}`;
}

function loadLists(): StoredLists {
  if (typeof window === "undefined") return {};
  try {
    const raw: StoredLists = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    // Older versions stored lists keyed by plain name (always "characters").
    // Remap any such legacy key on load so existing lists aren't orphaned.
    const migrated: StoredLists = {};
    for (const [key, value] of Object.entries(raw)) {
      migrated[key.includes("::") ? key : storageKey("characters", key)] = value;
    }
    return migrated;
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

function loadNickname(): string {
  if (typeof window === "undefined") return "Spieler";
  try {
    return window.localStorage.getItem(NICKNAME_KEY) || "Spieler";
  } catch {
    return "Spieler";
  }
}

export function TierListEditor() {
  const [category, setCategory] = useState("characters");
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() => loadCustomCategories());
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customItemsText, setCustomItemsText] = useState("");

  const [listName, setListName] = useState(DEFAULT_LIST_NAME);
  const [allLists, setAllLists] = useState<StoredLists>(() => loadLists());
  const [publicFlags, setPublicFlags] = useState<PublicFlags>({});
  const [assignments, setAssignments] = useState<Assignments>(
    () => allLists[storageKey("characters", DEFAULT_LIST_NAME)] ?? {}
  );
  const [compareWith, setCompareWith] = useState<string>("");
  const [syncState, setSyncState] = useState<"off" | "loading" | "synced" | "auth-error" | "query-error">(
    isSupabaseConfigured() ? "loading" : "off"
  );
  const [syncErrorDetail, setSyncErrorDetail] = useState("");

  const [nickname, setNickname] = useState(() => loadNickname());
  const [myShareCode, setMyShareCode] = useState<string | null>(null);
  const [friendLists, setFriendLists] = useState<Record<string, { category: string; assignments: Assignments }>>({});
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [friendLoadStatus, setFriendLoadStatus] = useState<"idle" | "loading" | "ok" | "not-found">("idle");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [newAchievements, setNewAchievements] = useState<TierListAchievement[]>([]);

  const items: RankableItem[] = builtInCategory(category)?.items ?? customCategories.find((c) => c.id === category)?.items ?? [];
  const categoryLabel =
    builtInCategory(category)?.label ?? customCategories.find((c) => c.id === category)?.label ?? category;

  useEffect(() => {
    try {
      window.localStorage.setItem(NICKNAME_KEY, nickname);
    } catch {
      // ignore
    }
  }, [nickname]);

  // Creates/loads this browser's share code once Supabase is configured.
  // Re-runs only when the nickname changes (not on every render), since
  // ensureProfile() itself is idempotent for the code and only updates
  // the nickname server-side.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    ensureProfile(nickname).then((profile) => {
      if (!cancelled && profile) setMyShareCode(profile.share_code);
    });
    return () => {
      cancelled = true;
    };
  }, [nickname]);

  async function loadFriendCode() {
    const code = friendCodeInput.trim();
    if (!code) return;
    setFriendLoadStatus("loading");
    const { ok, lists } = await fetchPublicListsByShareCode(code);
    if (!ok || lists.length === 0) {
      setFriendLoadStatus("not-found");
      return;
    }
    setFriendLists((prev) => {
      const next = { ...prev };
      for (const l of lists) {
        next[`${l.ownerNickname}: ${l.name}`] = { category: l.category, assignments: l.assignments as Assignments };
      }
      return next;
    });
    setFriendLoadStatus("ok");
  }

  // One-time async fetch of this browser's remote tier lists, merged over
  // the local cache (remote wins on name clashes since it's the source of
  // truth once configured). This is a genuine network round-trip, not a
  // synchronous state mirror, so it belongs in an effect.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchMyTierLists().then(({ userId, lists: remoteLists, error }) => {
      if (cancelled) return;
      if (!userId) {
        setSyncState("auth-error");
        return;
      }
      if (error) {
        setSyncState("query-error");
        setSyncErrorDetail(error);
        return;
      }
      setAllLists((prev) => {
        const merged = { ...prev };
        const flags: PublicFlags = {};
        for (const list of remoteLists) {
          const key = storageKey(list.category, list.name);
          merged[key] = list.assignments as Assignments;
          flags[key] = list.is_public;
        }
        setPublicFlags((prevFlags) => ({ ...prevFlags, ...flags }));
        const currentKey = storageKey(category, listName);
        if (merged[currentKey]) setAssignments(merged[currentKey]);
        return merged;
      });
      setSyncState("synced");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(nextAssignments: Assignments, nextPublic = publicFlags[storageKey(category, listName)] ?? false) {
    const key = storageKey(category, listName);
    const next = { ...allLists, [key]: nextAssignments };
    setAllLists(next);
    saveLists(next);
    if (isSupabaseConfigured()) {
      saveTierListRemote(listName, category, nextAssignments, nextPublic).then(({ error }) => {
        if (error) {
          setSyncState("query-error");
          setSyncErrorDetail(error);
        } else {
          setSyncState("synced");
        }
      });
    }
  }

  async function finalizeIfComplete(nextAssignments: Assignments) {
    const assignedCount = Object.keys(nextAssignments).length;
    if (assignedCount < items.length) return;
    const earned = checkTierListAchievements(category, assignedCount, items.length);
    if (earned.length === 0) return;
    const results = await Promise.all(earned.map(async (a) => ({ a, isNew: await unlockAchievement(a.id) })));
    const fresh = results.filter((r) => r.isNew).map((r) => r.a);
    if (fresh.length > 0) {
      incrementXp(fresh.length * XP_ACHIEVEMENT_BONUS);
      setNewAchievements(fresh);
    }
  }

  function assign(itemId: string, tier: Tier) {
    const next = { ...assignments, [itemId]: tier };
    setAssignments(next);
    persist(next);
    setSelectedItemId(null);
    finalizeIfComplete(next);
  }

  /** Tap-to-assign: tap an item to select it, then tap a tier row to place it (Q91/Q157 — no native drag & drop on touch). */
  function handleItemTap(itemId: string) {
    setSelectedItemId((prev) => (prev === itemId ? null : itemId));
  }

  function handleTierTap(tier: Tier) {
    if (!selectedItemId) return;
    assign(selectedItemId, tier);
  }

  function togglePublic() {
    const key = storageKey(category, listName);
    const nextPublic = !(publicFlags[key] ?? false);
    setPublicFlags((prev) => ({ ...prev, [key]: nextPublic }));
    persist(assignments, nextPublic);
  }

  function switchCategory(nextCategory: string) {
    setCategory(nextCategory);
    setListName(DEFAULT_LIST_NAME);
    setAssignments(allLists[storageKey(nextCategory, DEFAULT_LIST_NAME)] ?? {});
    setCompareWith("");
    setSelectedItemId(null);
    setNewAchievements([]);
  }

  function handleCreateCustomCategory() {
    if (!customLabel.trim() || !customItemsText.trim()) return;
    const cat = createCustomCategory(customLabel, customItemsText.split("\n"));
    const next = [...customCategories, cat];
    setCustomCategories(next);
    saveCustomCategories(next);
    setShowCustomForm(false);
    setCustomLabel("");
    setCustomItemsText("");
    switchCategory(cat.id);
  }

  function unassigned() {
    return items.filter((item) => !assignments[item.id]);
  }

  // Names of saved lists within the currently selected category, for the
  // "compare with" dropdown — comparing an Arcs list against a Characters
  // list wouldn't make sense.
  const namesInCategory = Object.keys(allLists)
    .filter((key) => key.startsWith(`${category}::`))
    .map((key) => key.slice(category.length + 2))
    .filter((name) => name !== listName);
  const friendNamesInCategory = Object.entries(friendLists)
    .filter(([, v]) => v.category === category)
    .map(([name]) => name);

  const compareRaw = compareWith
    ? friendLists[compareWith]?.assignments ?? allLists[storageKey(category, compareWith)]
    : null;
  const compareAssignments = compareRaw ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Kategorie
          <Select
            value={category}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setShowCustomForm(true);
                return;
              }
              switchCategory(e.target.value);
            }}
          >
            {BUILT_IN_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
            {customCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} (eigene)
              </option>
            ))}
            <option value="__new__">+ Eigene Kategorie erstellen</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Listenname
          <Input
            value={listName}
            onChange={(e) => {
              const name = e.target.value || DEFAULT_LIST_NAME;
              setListName(name);
              setAssignments(allLists[storageKey(category, name)] ?? {});
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Vergleichen mit
          <Select value={compareWith} onChange={(e) => setCompareWith(e.target.value)}>
            <option value="">– keine –</option>
            {namesInCategory.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            {friendNamesInCategory.map((name) => (
              <option key={name} value={name}>
                {name} (Freund)
              </option>
            ))}
          </Select>
        </label>
        {isSupabaseConfigured() ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publicFlags[storageKey(category, listName)] ?? false}
              onChange={togglePublic}
            />
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
            <span className="text-danger">
              Nur lokal – Supabase-Anmeldung fehlgeschlagen. Bitte in den
              Supabase-Projekteinstellungen unter Authentication → Sign In
              Methods &bdquo;Anonymous Sign-Ins&ldquo; aktivieren.
            </span>
          )}
          {syncState === "query-error" && (
            <span className="text-danger">
              Nur lokal – Datenbankfehler ({syncErrorDetail}). Vermutlich
              wurde eine Migration noch nicht auf dem Supabase-Projekt
              ausgeführt.
            </span>
          )}
        </p>
      </div>

      {showCustomForm && (
        <div className="flex flex-col gap-3 rounded-lg border border-mode-tierlisten/40 bg-mode-tierlisten/5 p-4 max-w-md">
          <label className="flex flex-col gap-1 text-sm">
            Name der Kategorie
            <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="z. B. Teufelsfrüchte" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Einträge (einer pro Zeile)
            <textarea
              value={customItemsText}
              onChange={(e) => setCustomItemsText(e.target.value)}
              rows={5}
              placeholder={"Gomu Gomu no Mi\nMera Mera no Mi\nHie Hie no Mi"}
              className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5 font-mono text-xs"
            />
          </label>
          <div className="flex gap-3">
            <Button onClick={handleCreateCustomCategory}>Kategorie erstellen</Button>
            <button onClick={() => setShowCustomForm(false)} className="text-sm text-black/50 dark:text-white/40">
              Abbrechen
            </button>
          </div>
          <p className="text-xs text-black/50 dark:text-white/40">
            Eigene Kategorien werden aktuell nur in diesem Browser gespeichert (kein Sync mit Freunden).
          </p>
        </div>
      )}

      {isSupabaseConfigured() && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 dark:border-white/10 p-3">
          <label className="flex flex-col gap-1 text-sm">
            Dein Name
            <Input value={nickname} onChange={(e) => setNickname(e.target.value || "Spieler")} />
          </label>
          <div className="text-sm">
            <p className="text-black/60 dark:text-white/50">Dein Freund-Code</p>
            <p className="font-[family-name:var(--font-mono)] text-lg tracking-widest">{myShareCode ?? "…"}</p>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Freund-Code eingeben
            <div className="flex gap-2">
              <Input
                value={friendCodeInput}
                onChange={(e) => setFriendCodeInput(e.target.value)}
                placeholder="z. B. AB3XQ9"
                className="font-[family-name:var(--font-mono)] uppercase"
              />
              <Button size="sm" onClick={loadFriendCode}>
                Laden
              </Button>
            </div>
          </label>
          <p className="text-xs text-black/50 dark:text-white/40">
            {friendLoadStatus === "loading" && "Suche…"}
            {friendLoadStatus === "ok" && "Gefunden – jetzt oben bei „Vergleichen mit“ wählbar."}
            {friendLoadStatus === "not-found" &&
              "Kein Code gefunden oder dein Freund hat noch keine öffentliche Liste."}
          </p>
        </div>
      )}

      <h2 className="text-lg font-semibold">{categoryLabel}</h2>

      {newAchievements.length > 0 && (
        <div className="op-pop-in rounded-xl border border-mode-tierlisten bg-mode-tierlisten/10 p-3">
          <p className="mb-1 text-sm font-semibold text-mode-tierlisten">🏆 Neue Erfolge freigeschaltet!</p>
          <ul className="flex flex-col gap-0.5 text-xs text-black/70 dark:text-white/60">
            {newAchievements.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.label}</span> — {a.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedItemId && (
        <p className="text-sm text-mode-tierlisten">
          „{items.find((i) => i.id === selectedItemId)?.name}“ ausgewählt — tippe jetzt eine Tier-Reihe an, um es
          dort einzuordnen.
        </p>
      )}

      <div className="grid gap-3">
        {TIERS.map((tier) => (
          <div
            key={tier}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/rank-item-id");
              if (id) assign(id, tier);
            }}
            onClick={() => handleTierTap(tier)}
            className={`flex items-start gap-3 rounded-lg border border-dashed p-3 min-h-20 ${
              selectedItemId ? "border-mode-tierlisten/60 bg-mode-tierlisten/5 cursor-pointer" : "border-black/15 dark:border-white/15"
            }`}
          >
            <span className="w-8 shrink-0 text-center text-lg font-bold">
              {tier}
            </span>
            <div className="flex flex-wrap gap-2">
              {items
                .filter((item) => assignments[item.id] === tier)
                .map((item) => (
                  <div key={item.id} className="relative" onClick={(e) => e.stopPropagation()}>
                    <RankItemCard
                      item={item}
                      draggable
                      onDragStart={() => {}}
                      onClick={handleItemTap}
                      selected={selectedItemId === item.id}
                    />
                    {compareAssignments && compareAssignments[item.id] && compareAssignments[item.id] !== tier && (
                      <span className="absolute -top-2 -right-2 rounded-full bg-mode-tierlisten text-white text-[10px] px-1.5 py-0.5">
                        dort: {compareAssignments[item.id]}
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
          Noch nicht eingestuft – tippe einen Eintrag an und dann eine Tier-Reihe (oder zieh ihn per Drag & Drop)
        </h3>
        <div className="flex flex-wrap gap-2">
          {unassigned().map((item) => (
            <RankItemCard
              key={item.id}
              item={item}
              draggable
              onDragStart={() => {}}
              onClick={handleItemTap}
              selected={selectedItemId === item.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
