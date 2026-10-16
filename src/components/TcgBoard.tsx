"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/Button";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  fetchMyTcgCollection,
  fetchTcgCards,
  fetchTcgPackClaimedToday,
  getCurrentAuthUser,
  isSupabaseConfigured,
  openDailyTcgPack,
  type AuthUser,
  type TcgCard,
} from "@/lib/supabase";
import { RARITIES, revealHoldMs, type TcgRarity } from "@/lib/tcgRarities";

type DrawnCard = { cardId: string; characterName: string; versionLabel: string; rarity: TcgRarity; imageUrl: string | null };

/** Single card face — used both for the pack-reveal overlay and the collection grid. */
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
      className={`relative flex aspect-[2/3] flex-col overflow-hidden rounded-xl border border-black/10 bg-[var(--surface)] dark:border-white/10 ${
        show ? `${meta.ringClass} ${meta.glowClass}` : "opacity-40 grayscale"
      }`}
    >
      <div className="relative flex-1 bg-black/20">
        {show && card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt={card.characterName} referrerPolicy="no-referrer" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl" aria-hidden>
            {show ? "🏴‍☠️" : "❔"}
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
    </div>
  );
}

/** Sequential pack-reveal overlay — one card flips in at a time, held longer for rarer pulls (Q: Animation je Rarität). Always animated regardless of the global "Animationen aus" switch, since this is the mode's one highlight moment. */
function PackRevealOverlay({ cards, onClose }: { cards: DrawnCard[]; onClose: () => void }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= cards.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), revealHoldMs(cards[shown].rarity));
    return () => clearTimeout(t);
  }, [shown, cards]);

  const done = shown >= cards.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-4">
      <div className="grid w-full max-w-sm grid-cols-5 gap-2">
        {cards.map((c, i) => (
          <CardFace key={i} card={c} owned revealed={i < shown} />
        ))}
      </div>
      {done ? (
        <Button onClick={onClose}>Weiter zur Sammlung</Button>
      ) : (
        <p className="text-sm text-white/60">Tippe nicht weg, die Karten decken sich auf…</p>
      )}
    </div>
  );
}

export function TcgBoard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [cards, setCards] = useState<TcgCard[]>([]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [claimedToday, setClaimedToday] = useState(false);
  const [opening, setOpening] = useState(false);
  const [drawn, setDrawn] = useState<DrawnCard[] | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    const [c, o, claimed] = await Promise.all([fetchTcgCards(), fetchMyTcgCollection(), fetchTcgPackClaimedToday()]);
    setCards(c);
    setOwned(o);
    setClaimedToday(claimed);
  }

  useEffect(() => {
    getCurrentAuthUser().then(async (u) => {
      setUser(u);
      if (u?.isAdmin) await refresh();
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
  }

  async function closeReveal() {
    setDrawn(null);
    await refresh();
  }

  if (!isSupabaseConfigured() || !loaded) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="op-card p-6 text-center text-sm text-black/60 dark:text-white/50">
        Der TCG-Modus ist aktuell nur für Admins zum Testen freigeschaltet.
      </div>
    );
  }

  const ownedCount = Object.keys(owned).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="op-card flex flex-col items-center gap-3 p-5 text-center">
        <p className="text-sm text-black/60 dark:text-white/50">
          {ownedCount} von {cards.length} Karten gesammelt
        </p>
        <Button onClick={handleOpenPack} disabled={opening || claimedToday} size="md">
          {claimedToday ? "Heutiges Pack schon geöffnet" : opening ? "Öffne Pack…" : "Tages-Pack öffnen (5 Karten)"}
        </Button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">Sammlung</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {cards.map((card) => (
            <CardFace key={card.id} card={card} owned={Boolean(owned[card.id])} quantity={owned[card.id]} />
          ))}
        </div>
      </div>

      {drawn && <PackRevealOverlay cards={drawn} onClose={closeReveal} />}
    </div>
  );
}
