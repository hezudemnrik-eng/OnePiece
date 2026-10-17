"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/Button";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  exchangeTcgFragments,
  fetchMyTcgCollection,
  fetchMyTcgFragments,
  fetchTcgCards,
  fetchTcgGlobalEnabled,
  fetchTcgPackClaimedToday,
  getCurrentAuthUser,
  isSupabaseConfigured,
  openDailyTcgPack,
  resetMyTcgCollection,
  setTcgGlobalEnabled,
  type AuthUser,
  type TcgCard,
} from "@/lib/supabase";
import { RARITIES, revealHoldMs, type TcgRarity } from "@/lib/tcgRarities";

type DrawnCard = {
  cardId: string;
  characterName: string;
  versionLabel: string;
  rarity: TcgRarity;
  imageUrl: string | null;
  duplicate: boolean;
};

/** Single card face — used both for the pack-reveal overlay and the collection grid. Placeholder art is a rarity-colored icon (Q29/Q92), not a borrowed character photo, until Chatti's real per-version artwork lands. */
function CardFace({
  card,
  owned,
  quantity,
  revealed,
}: {
  card: { characterName: string; versionLabel: string; rarity: TcgRarity; imageUrl: string | null };
  owned: boolean;
  quantity?: number;
  revealed?: boolean;
}) {
  const meta = RARITIES[card.rarity];
  const show = revealed ?? owned;
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl border border-black/10 bg-[var(--surface)] dark:border-white/10 ${
        show ? (meta.frameImage ? "" : `${meta.ringClass} ${meta.glowClass}`) : "opacity-40 grayscale"
      }`}
    >
      {/* aspect-[2/3] sits on the art box itself (not the outer card), matching the Chatti frame artwork's own 2:3 canvas exactly — putting it on the outer box instead squeezed this shorter (meta text below eats some of that height), which stretched the frame off its native proportions and made it look like a smaller picture floating mid-card instead of a border flush with the art. */}
      <div className="relative aspect-[2/3] bg-black/20">
        {show && card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt={card.characterName} referrerPolicy="no-referrer" className="h-full w-full object-cover object-top" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/images/tcg/card-back.webp" alt="" aria-hidden className="h-full w-full object-cover" />
        )}
        {show && !card.imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-4xl" aria-hidden>
            {meta.icon}
          </div>
        )}
        {quantity !== undefined && quantity > 1 && (
          <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">×{quantity}</span>
        )}
      </div>
      <div className="px-1.5 py-1 text-center">
        <p className={`truncate text-[11px] font-semibold ${show ? meta.textClass : "text-black/40 dark:text-white/30"}`}>
          {show ? meta.label : "???"}
        </p>
        {show && (
          <>
            <p className="truncate text-xs font-semibold text-black dark:text-white">{card.characterName}</p>
            <p className="truncate text-[11px] text-black/60 dark:text-white/50">{card.versionLabel}</p>
          </>
        )}
      </div>
      {show && meta.frameImage && (
        // Sits on the outer card (not clipped to the art box) and renders
        // last so it's the topmost layer — Boss wants the enlarged frame
        // never cropped by the art box's own edge, only by the card's
        // outer rounded corner.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.frameImage}
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-10 w-full scale-[1.3] object-fill"
          style={{ aspectRatio: "2 / 3" }}
        />
      )}
    </div>
  );
}

/** Burst glow strength behind the big card, scaled by rarity so higher pulls visibly hit harder. */
const BURST_COLOR: Record<TcgRarity, string | null> = {
  rekrut: null,
  pirat: null,
  kopfgeldjaeger: "rgba(14,165,233,0.45)",
  rookie: "rgba(139,92,246,0.5)",
  supernova: "rgba(249,115,22,0.6)",
  yonko: "rgba(225,29,72,0.65)",
  god_tier: "rgba(244,197,66,0.8)",
};

/** Sequential pack-reveal overlay — one card flips in at a time, shown large and alone, held longer for rarer pulls (Q40/Q42/Q48). Always animated regardless of the global "Animationen aus" switch (Q47 — this is the mode's one highlight moment), and never skippable (Q43). */
function PackRevealOverlay({ cards, fragmentsGained, onClose }: { cards: DrawnCard[]; fragmentsGained: number; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const current = cards[index];

  useEffect(() => {
    if (finished) return;
    const t = setTimeout(() => {
      if (index < cards.length - 1) setIndex((i) => i + 1);
      else setFinished(true);
    }, revealHoldMs(current.rarity));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished]);

  const meta = RARITIES[current.rarity];
  const burstColor = BURST_COLOR[current.rarity];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/70 bg-cover bg-center p-4"
      style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.75)), url(/images/tcg/bg-pack-open.webp)" }}
    >
      <div className="flex items-center gap-1.5">
        {cards.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i === index && !finished ? "bg-white" : i < index || finished ? "bg-white/60" : "bg-white/20"
            }`}
          />
        ))}
      </div>

      {!finished && (
        <div key={index} className="relative flex flex-col items-center gap-3">
          {burstColor && (
            <div
              key={`burst-${index}`}
              className="op-tcg-burst pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: `radial-gradient(circle, ${burstColor} 0%, transparent 70%)` }}
              aria-hidden
            />
          )}
          <div className="op-tcg-card-flip relative w-56 sm:w-64">
            <CardFace card={current} owned revealed />
          </div>
          <div className="op-tcg-label-in flex flex-col items-center gap-0.5 text-center">
            <p className={`text-sm font-bold ${meta.textClass}`}>{meta.label}</p>
            {current.duplicate && <p className="text-xs font-semibold text-amber-400">Duplikat</p>}
          </div>
        </div>
      )}

      {finished ? (
        <>
          <div className="flex gap-2">
            {cards.map((c, i) => (
              <div key={i} className="w-12">
                <CardFace card={c} owned revealed />
              </div>
            ))}
          </div>
          {fragmentsGained > 0 && <p className="text-sm text-amber-400">+{fragmentsGained} Fragmente aus Duplikaten</p>}
          <Button onClick={onClose}>Weiter zur Sammlung</Button>
        </>
      ) : (
        <p className="text-sm text-white/60">
          Karte {index + 1} von {cards.length}
        </p>
      )}
    </div>
  );
}

export function TcgBoard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [cards, setCards] = useState<TcgCard[]>([]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [fragments, setFragments] = useState(0);
  const [claimedToday, setClaimedToday] = useState(false);
  const [opening, setOpening] = useState(false);
  const [drawn, setDrawn] = useState<DrawnCard[] | null>(null);
  const [fragmentsGained, setFragmentsGained] = useState(0);
  const [error, setError] = useState("");
  const [busyAdminAction, setBusyAdminAction] = useState(false);

  async function refresh() {
    const [c, o, claimed, frag, enabled] = await Promise.all([
      fetchTcgCards(),
      fetchMyTcgCollection(),
      fetchTcgPackClaimedToday(),
      fetchMyTcgFragments(),
      fetchTcgGlobalEnabled(),
    ]);
    setCards(c);
    setOwned(o);
    setClaimedToday(claimed);
    setFragments(frag);
    setGlobalEnabled(enabled);
  }

  useEffect(() => {
    getCurrentAuthUser().then(async (u) => {
      setUser(u);
      const enabled = await fetchTcgGlobalEnabled();
      setGlobalEnabled(enabled);
      if (u?.isAdmin || enabled) await refresh();
      setLoaded(true);
    });
  }, []);

  async function handleOpenPack() {
    setError("");
    setOpening(true);
    const result = await openDailyTcgPack();
    setOpening(false);
    if (!result.ok) {
      setError(
        result.error === "already_claimed"
          ? "Heute schon geöffnet — morgen gibt's das nächste Pack."
          : "Pack öffnen hat nicht geklappt."
      );
      return;
    }
    setDrawn(result.cards);
    setFragmentsGained(result.fragmentsGained);
  }

  async function closeReveal() {
    setDrawn(null);
    await refresh();
  }

  async function handleToggleGlobal() {
    setBusyAdminAction(true);
    const ok = await setTcgGlobalEnabled(!globalEnabled);
    setBusyAdminAction(false);
    if (ok) setGlobalEnabled((v) => !v);
  }

  async function handleResetCollection() {
    if (!window.confirm("Deine ganze TCG-Sammlung (Karten, Fragmente, heutiges Pack) wirklich zurücksetzen?")) return;
    setBusyAdminAction(true);
    const ok = await resetMyTcgCollection();
    setBusyAdminAction(false);
    if (ok) await refresh();
  }

  async function handleExchangeFragments() {
    const amount = Math.floor(fragments / 10) * 10;
    if (amount <= 0) return;
    const ok = await exchangeTcgFragments(amount);
    if (ok) await refresh();
  }

  if (!isSupabaseConfigured() || !loaded) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  const hasAccess = Boolean(user?.isAdmin) || globalEnabled;

  if (!hasAccess) {
    return (
      <div
        className="op-card overflow-hidden bg-cover bg-center p-6 text-center text-sm font-semibold text-white"
        style={{ backgroundImage: "linear-gradient(rgba(5,8,18,0.45), rgba(5,8,18,0.8)), url(/images/tcg/bg-tcg-start.webp)" }}
      >
        Der TCG-Modus kommt bald. 🏴‍☠️
      </div>
    );
  }

  const ownedCount = Object.keys(owned).length;

  return (
    <div
      className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl p-4"
      style={{ backgroundImage: "linear-gradient(rgba(5,8,18,0.55), rgba(5,8,18,0.88)), url(/images/tcg/bg-tcg-start.webp)", backgroundSize: "cover", backgroundPosition: "center" }}
    >
      {user?.isAdmin && (
        <div className="op-card flex flex-wrap items-center gap-2 p-3 text-xs">
          <span className="font-semibold text-mode-tcg">Admin:</span>
          <Button size="sm" variant="secondary" onClick={handleToggleGlobal} disabled={busyAdminAction}>
            {globalEnabled ? "Für alle sperren" : "Für alle freischalten"}
          </Button>
          <Button size="sm" variant="danger" onClick={handleResetCollection} disabled={busyAdminAction}>
            Meine Sammlung zurücksetzen
          </Button>
          <span className="text-black/50 dark:text-white/40">{globalEnabled ? "Für alle sichtbar" : "Nur für Admins sichtbar"}</span>
        </div>
      )}

      <div className="op-card flex flex-col items-center gap-3 p-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/tcg/pack-pouch.webp" alt="" aria-hidden className="h-20 w-auto object-contain" />
        <p className="text-sm text-black/60 dark:text-white/50">
          {ownedCount} von {cards.length} Karten gesammelt
        </p>
        <button
          onClick={handleOpenPack}
          disabled={opening || claimedToday}
          className="relative flex w-72 max-w-full items-center justify-center bg-contain bg-center bg-no-repeat px-12 text-center text-[11px] font-bold leading-tight text-[#3a2410] disabled:opacity-60"
          style={{ backgroundImage: "url(/images/tcg/button-plaque.webp)", aspectRatio: "600 / 204" }}
        >
          {claimedToday ? "Heutiges Pack schon geöffnet" : opening ? "Öffne Pack…" : "Tages-Pack öffnen (5 Karten)"}
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex items-center gap-2 text-xs text-amber-500">
          <span>{fragments} Fragmente</span>
          {fragments >= 10 && (
            <button onClick={handleExchangeFragments} className="underline">
              in Berry umtauschen (10:1)
            </button>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">Sammlung</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {cards.map((card) => (
            <CardFace key={card.id} card={card} owned={Boolean(owned[card.id])} quantity={owned[card.id]} />
          ))}
        </div>
      </div>

      {drawn && <PackRevealOverlay cards={drawn} fragmentsGained={fragmentsGained} onClose={closeReveal} />}
    </div>
  );
}
