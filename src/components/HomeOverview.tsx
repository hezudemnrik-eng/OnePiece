"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { characters } from "@/lib/characters";
import { MODES, MODE_GROUPS } from "@/lib/modes";
import { getLevelProgress } from "@/lib/levels";
import { getLastPlayedHref } from "@/lib/lastPlayed";
import { getTodaysChallenge, type DailyChallenge } from "@/lib/dailyChallenge";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  fetchFriends,
  fetchMyLevelInfo,
  fetchRelevantLiveDrafts,
  getCurrentAuthUser,
  isSupabaseConfigured,
  type Friend,
  type MyLevelInfo,
  type OpenLiveDraft,
} from "@/lib/supabase";

function avatarFor(id: string | null) {
  return id ? characters.find((c) => c.id === id) : null;
}

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
  const [username, setUsername] = useState<string | null>(null);
  const [levelInfo, setLevelInfo] = useState<MyLevelInfo | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myLobby, setMyLobby] = useState<OpenLiveDraft | null>(null);
  const [lastHref, setLastHref] = useState<string | null>(null);
  // new Date() is a "dynamic" API under Next's Cache Components prerendering
  // (same class of thing as Date.now()/Math.random()), so both the greeting
  // and the daily challenge are computed client-side only, after mount,
  // rather than directly in the render body.
  const [greetingText, setGreetingText] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
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
    Promise.all([getCurrentAuthUser(), fetchMyLevelInfo(), fetchFriends(), fetchRelevantLiveDrafts()]).then(
      ([user, level, friendList, drafts]) => {
        setUsername(user?.username ?? null);
        setLevelInfo(level);
        setFriends(friendList);
        setMyLobby(drafts.find((d) => d.isMine) ?? null);
        setLoaded(true);
      }
    );
  }, []);

  const progress = levelInfo ? getLevelProgress(levelInfo.xp) : null;
  const lastMode = lastHref ? MODES.find((m) => m.href === lastHref) : undefined;
  const onlineFriends = friends.filter((f) => f.online);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
      <p className="text-sm text-black/60 dark:text-white/50">
        {greetingText ?? "Willkommen"}
        {username ? `, ${username}` : ""}.
      </p>

      {isSupabaseConfigured() && !loaded && <LoadingSpinner />}

      {isSupabaseConfigured() && loaded && progress && (
        <Card variant="plain" className="px-4 py-3">
          <div className="flex items-center justify-between mb-1.5 text-sm">
            <span className="font-semibold">
              Level {progress.level} · {progress.rankTitle}
            </span>
            <span className="tabular-nums text-black/50 dark:text-white/40 font-[family-name:var(--font-mono)]">
              {progress.xp - progress.levelStartXp}/{progress.levelEndXp - progress.levelStartXp} XP
            </span>
          </div>
          <ProgressBar progress={progress.progress} size="md" />
        </Card>
      )}

      {myLobby ? (
        <Link href={`/draft/live?code=${myLobby.inviteCode}`}>
          <Card variant="spotlight" accent="draft" className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              Weiterspielen: Live-Draft <span className="font-mono">{myLobby.inviteCode}</span>
              <span className="block font-normal text-black/60 dark:text-white/50">
                {myLobby.phase === "lobby" ? "wartet auf Spieler" : "läuft gerade"}
              </span>
            </span>
            <span className="text-accent text-xl" aria-hidden>
              →
            </span>
          </Card>
        </Link>
      ) : lastMode ? (
        <Link href={lastMode.href}>
          <Card variant="spotlight" accent={lastMode.accent} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-xl" aria-hidden>
                {lastMode.icon}
              </span>
              Weiterspielen: {lastMode.title}
            </span>
            <span className="text-accent text-xl" aria-hidden>
              →
            </span>
          </Card>
        </Link>
      ) : (
        <Card variant="spotlight" accent="accent">
          <p className="text-sm font-semibold mb-1">Willkommen an Bord! 🏴‍☠️</p>
          <p className="text-sm text-black/60 dark:text-white/50">Wähle unten einen Bereich und leg los.</p>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2">
        {MODE_GROUPS.map((g) => (
          <Link key={g.id} href={g.href}>
            <Card
              variant="spotlight"
              accent={g.id === "kampf" ? "duell" : g.id === "raetsel-ranking" ? "quiz" : "crew"}
              className="flex flex-col items-center gap-1 py-4 text-center"
            >
              <span className="text-2xl" aria-hidden>
                {g.icon}
              </span>
              <span className="text-xs font-semibold leading-tight">{g.title}</span>
            </Card>
          </Link>
        ))}
      </div>

      {challenge && (
        <Link href={challenge.href}>
          <Card variant="parchment" accent={challenge.accent} className="flex items-center gap-3 px-4 py-3">
            <span className="text-lg" aria-hidden>
              {challenge.icon}
            </span>
            <span className="text-sm">
              <span className="font-semibold">Heute: </span>
              {challenge.text}
            </span>
          </Card>
        </Link>
      )}

      {isSupabaseConfigured() && loaded && onlineFriends.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-black/60 dark:text-white/50">
          <div className="flex -space-x-2">
            {onlineFriends.slice(0, 5).map((p) => {
              const avatar = avatarFor(p.avatarCharacterId);
              return avatar?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.userId}
                  src={avatar.imageUrl}
                  alt={p.username}
                  referrerPolicy="no-referrer"
                  title={p.username}
                  className="h-6 w-6 rounded-full border-2 border-[var(--background)] object-cover object-top"
                />
              ) : (
                <span
                  key={p.userId}
                  title={p.username}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--background)] bg-accent/15 text-[9px] font-bold text-accent"
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
