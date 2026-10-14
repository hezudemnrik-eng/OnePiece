"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { characters } from "@/lib/characters";
import { MODES, MODE_GROUPS, SHOP_TILE } from "@/lib/modes";
import { COSMETIC_FRAMES, getLevelProgress } from "@/lib/levels";
import { FRAME_IMAGES } from "@/lib/frameImages";
import { BERRY_ICON, ICON_IMAGES } from "@/lib/iconImages";
import { getLastPlayedHref } from "@/lib/lastPlayed";
import { getTodaysChallenge, type DailyChallenge } from "@/lib/dailyChallenge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  fetchDailyQuestClaimedToday,
  fetchFriends,
  fetchMyLevelInfo,
  fetchRelevantLiveDrafts,
  fetchShopItems,
  getCurrentAuthUser,
  isSupabaseConfigured,
  type AuthUser,
  type Friend,
  type MyLevelInfo,
  type OpenLiveDraft,
} from "@/lib/supabase";

function avatarFor(id: string | null) {
  return id ? characters.find((c) => c.id === id) : null;
}

/** Illustrated artwork (Boss's ChatGPT assets) behind the mode tiles and the "Weiterspielen" hero card. */
const TILE_IMAGES: Record<string, string> = {
  "/kampf": "/images/tile-kampf.jpg",
  "/raetsel-ranking": "/images/tile-raetsel.jpg",
  "/builder": "/images/tile-builder.jpg",
  "/shop": "/images/tile-shop.jpg",
};

function greeting(hour: number): string {
  if (hour < 5) return "Noch wach";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Ahoi";
  return "Guten Abend";
}

/**
 * Deliberately small: Q69 asks for no scrolling anywhere outside settings,
 * and Q63/Q67 ask for a reduced, curated Home rather than the old
 * everything-at-once dashboard. The leaderboard, quiz leaderboard, recent
 * match history and the full 10-mode grid that used to live here move to
 * the Profile page (Phase 4) instead of disappearing.
 */
export function HomeOverview() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [levelInfo, setLevelInfo] = useState<MyLevelInfo | null>(null);
  const [frameImage, setFrameImage] = useState<string | null>(null);
  const [frameClass, setFrameClass] = useState("");
  const [colorClass, setColorClass] = useState("");
  const [title, setTitle] = useState<{ label: string; className: string } | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myLobby, setMyLobby] = useState<OpenLiveDraft | null>(null);
  const [lastHref, setLastHref] = useState<string | null>(null);
  // new Date() is a "dynamic" API under Next's Cache Components prerendering
  // (same class of thing as Date.now()/Math.random()), so both the greeting
  // and the daily challenge are computed client-side only, after mount,
  // rather than directly in the render body.
  const [greetingText, setGreetingText] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [questClaimed, setQuestClaimed] = useState(false);
  const [loaded, setLoaded] = useState(() => !isSupabaseConfigured());

  useEffect(() => {
    // Deferred a tick (rather than read synchronously at the top of the
    // effect) so none of this runs during server/static prerendering of "/" —
    // localStorage/Date access has to stay strictly client-only here.
    Promise.resolve().then(() => {
      setLastHref(getLastPlayedHref());
      const now = new Date();
      setGreetingText(greeting(now.getHours()));
      setChallenge(getTodaysChallenge(now));
    });
    if (!isSupabaseConfigured()) return;
    Promise.all([
      getCurrentAuthUser(),
      fetchMyLevelInfo(),
      fetchShopItems(),
      fetchFriends(),
      fetchRelevantLiveDrafts(),
      fetchDailyQuestClaimedToday(),
    ]).then(([authUser, level, items, friendList, drafts, questClaimedToday]) => {
      setUser(authUser);
      setLevelInfo(level);
      setFrameClass(
        COSMETIC_FRAMES.find((f) => f.id === level?.equippedFrame)?.className ??
          items.find((i) => i.category === "frame" && i.id === level?.equippedFrame)?.className ??
          ""
      );
      setFrameImage(level?.equippedFrame ? (FRAME_IMAGES[level.equippedFrame] ?? null) : null);
      setColorClass(items.find((i) => i.category === "color" && i.id === level?.equippedColor)?.className ?? "");
      const activeTitle = items.find((i) => i.category === "title" && i.id === level?.equippedTitle);
      setTitle(activeTitle ? { label: activeTitle.label, className: activeTitle.className } : null);
      setFriends(friendList);
      setMyLobby(drafts.find((d) => d.isMine) ?? null);
      setQuestClaimed(questClaimedToday);
      setLoaded(true);
    });
  }, []);

  const progress = levelInfo ? getLevelProgress(levelInfo.xp) : null;
  const lastMode = lastHref ? MODES.find((m) => m.href === lastHref) : undefined;
  const onlineFriends = friends.filter((f) => f.online);
  const avatar = avatarFor(user?.avatarCharacterId ?? null);

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-6 flex flex-col gap-4">
      <p className="truncate whitespace-nowrap text-sm text-black/60 dark:text-white/50">
        {greetingText ?? "Willkommen"}
        {user?.username ? `, ${user.username}` : ""}.
      </p>

      {isSupabaseConfigured() && !loaded && <LoadingSpinner />}

      {isSupabaseConfigured() && loaded && progress && (
        <Link href="/profil">
          <div
            className="op-card op-framed flex items-center gap-4 bg-cover bg-center p-4"
            style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('/images/map-background.jpg')" }}
          >
            <span className="relative flex h-20 w-20 shrink-0 items-center justify-center">
              {frameImage ? (
                <>
                  {avatar?.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar.imageUrl}
                      alt={avatar.name}
                      referrerPolicy="no-referrer"
                      className="h-14 w-14 rounded-full object-cover object-top"
                    />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frameImage} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                </>
              ) : (
                avatar?.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar.imageUrl}
                    alt={avatar.name}
                    referrerPolicy="no-referrer"
                    className={`h-14 w-14 rounded-full object-cover object-top border-2 border-white ${frameClass}`}
                  />
                )
              )}
              <span className="absolute -bottom-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold tabular-nums text-poster-ink">
                {progress.level}
              </span>
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2 text-base">
                <span className={`truncate whitespace-nowrap font-semibold text-white ${colorClass}`}>{user?.username}</span>
                {user?.isAdmin && <span className="shrink-0 text-xs text-accent-ink">(Admin)</span>}
                {title && <span className={`shrink-0 text-xs opacity-80 ${title.className}`}>{title.label}</span>}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 mb-1 text-sm">
                <span className="flex min-w-0 items-center gap-1.5 truncate whitespace-nowrap font-semibold text-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/ship-wheel.webp" alt="" aria-hidden className="h-4 w-4 shrink-0 object-contain" />
                  {progress.rankTitle}
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-white/70 font-[family-name:var(--font-mono)]">
                  {progress.xp - progress.levelStartXp}/{progress.levelEndXp - progress.levelStartXp} XP
                </span>
              </div>
              <ProgressBar progress={progress.progress} size="md" />
              <span className="mt-1.5 flex items-center gap-1 whitespace-nowrap font-display tabular-nums text-accent-ink">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BERRY_ICON} alt="" aria-hidden className="h-4 w-4 object-contain drop-shadow-sm" />
                {(levelInfo?.berries ?? 0).toLocaleString("de-DE")}
              </span>
            </div>
          </div>
        </Link>
      )}

      {myLobby ? (
        <Link href={`/draft/live?code=${myLobby.inviteCode}`}>
          <div
            className="op-card relative flex min-h-[96px] items-end overflow-hidden bg-cover bg-center p-4"
            style={{ backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.15)), url('/images/banner-weiterspielen.jpg')" }}
          >
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="min-w-0 text-sm font-semibold text-white">
                <span className="block truncate whitespace-nowrap">
                  Weiterspielen: Live-Draft <span className="font-mono">{myLobby.inviteCode}</span>
                </span>
                <span className="block truncate whitespace-nowrap font-normal text-white/70">
                  {myLobby.phase === "lobby" ? "wartet auf Spieler" : "läuft gerade"}
                </span>
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white text-xl text-white" aria-hidden>
                →
              </span>
            </div>
          </div>
        </Link>
      ) : lastMode ? (
        <Link href={lastMode.href}>
          <div
            className="op-card relative flex min-h-[96px] items-end overflow-hidden bg-cover bg-center p-4"
            style={{ backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.15)), url('/images/banner-weiterspielen.jpg')" }}
          >
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 truncate whitespace-nowrap text-sm font-semibold text-white">
                {ICON_IMAGES[lastMode.icon] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ICON_IMAGES[lastMode.icon]} alt="" aria-hidden className="h-10 w-10 shrink-0 object-contain drop-shadow-md" />
                ) : (
                  <span className="shrink-0 text-2xl drop-shadow-md" aria-hidden>
                    {lastMode.icon}
                  </span>
                )}
                <span className="truncate">Weiterspielen: {lastMode.title}</span>
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white text-xl text-white" aria-hidden>
                →
              </span>
            </div>
          </div>
        </Link>
      ) : (
        <div
          className="op-card relative flex min-h-[96px] flex-col justify-end overflow-hidden bg-cover bg-center p-4"
          style={{ backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.15)), url('/images/banner-weiterspielen.jpg')" }}
        >
          <p className="truncate whitespace-nowrap text-sm font-semibold text-white mb-1">Willkommen an Bord! 🏴‍☠️</p>
          <p className="truncate whitespace-nowrap text-sm text-white/70">Wähle unten einen Bereich und leg los.</p>
        </div>
      )}

      {challenge && (
        <Link href="/questbuch">
          <div
            className="op-card flex items-center gap-3 bg-cover bg-center px-4 py-3"
            style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('/images/map-background.jpg')" }}
          >
            {ICON_IMAGES[challenge.icon] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ICON_IMAGES[challenge.icon]} alt="" aria-hidden className="h-9 w-9 shrink-0 object-contain drop-shadow-md" />
            ) : (
              <span className="shrink-0 text-xl drop-shadow-md" aria-hidden>
                📖
              </span>
            )}
            {questClaimed ? (
              <span className="min-w-0 truncate whitespace-nowrap text-sm text-white">
                <span className="font-semibold">Tagesquest erledigt ✅</span> — Questbuch öffnen
              </span>
            ) : (
              <span className="min-w-0 truncate whitespace-nowrap text-sm text-white">
                <span className="font-semibold">Heute: </span>
                {challenge.text}
              </span>
            )}
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2">
        {[...MODE_GROUPS, SHOP_TILE].map((g) => (
          <Link key={g.href} href={g.href}>
            <div
              className="relative flex min-h-[110px] flex-col justify-end overflow-hidden rounded-xl border-[3px] bg-cover bg-center p-3 shadow-[5px_5px_0_0_var(--foreground)]"
              style={{
                borderColor: `var(--mode-${"id" in g ? (g.id === "kampf" ? "duell" : g.id === "raetsel-ranking" ? "quiz" : "crew") : "shop"})`,
                backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.05)), url('${TILE_IMAGES[g.href] ?? ""}')`,
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate whitespace-nowrap text-xs font-semibold leading-tight text-white">{g.title}</span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white text-sm text-white" aria-hidden>
                  →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {isSupabaseConfigured() && loaded && onlineFriends.length > 0 && (
        <div className="flex items-center gap-2 whitespace-nowrap text-sm text-black/60 dark:text-white/50">
          <div className="flex -space-x-2">
            {onlineFriends.slice(0, 5).map((p) => {
              const friendAvatar = avatarFor(p.avatarCharacterId);
              return friendAvatar?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.userId}
                  src={friendAvatar.imageUrl}
                  alt={p.username}
                  referrerPolicy="no-referrer"
                  title={p.username}
                  className="h-6 w-6 rounded-full border-2 border-[var(--background)] object-cover object-top"
                />
              ) : (
                <span
                  key={p.userId}
                  title={p.username}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--background)] bg-accent/15 text-[9px] font-bold text-accent-ink"
                >
                  {p.username.slice(0, 2).toUpperCase()}
                </span>
              );
            })}
          </div>
          <span>{onlineFriends.length} online</span>
        </div>
      )}
    </main>
  );
}
