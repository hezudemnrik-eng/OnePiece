"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { characters } from "@/lib/characters";
import { AVATAR_CHOICES } from "@/lib/avatarChoices";
import {
  COSMETIC_FRAMES,
  framesUnlockedAtLevel,
  getLevelProgress,
  type LevelProgress,
} from "@/lib/levels";
import { FUSION_ACHIEVEMENTS } from "@/lib/fusionAchievements";
import { DUEL_ACHIEVEMENTS } from "@/lib/duelAchievements";
import { QUIZ_ACHIEVEMENTS } from "@/lib/quizAchievements";
import { CREW_ACHIEVEMENTS } from "@/lib/crewAchievements";
import { BLIND_RANKING_ACHIEVEMENTS } from "@/lib/blindRankingAchievements";
import { DRAFT_ACHIEVEMENTS } from "@/lib/draftAchievements";
import { TIER_LIST_ACHIEVEMENTS } from "@/lib/tierListAchievements";
import { formatBerry } from "@/lib/fusionTraits";
import { LoadingSpinner } from "./LoadingSpinner";
import { FriendsPanel } from "./FriendsPanel";
import { Card } from "./ui/Card";
import { ProgressBar } from "./ui/ProgressBar";
import {
  ensureProfile,
  fetchGlobalLeaderboard,
  fetchLeaderboard,
  fetchMyAchievements,
  fetchMyLevelInfo,
  fetchMyRecentMatches,
  fetchQuizLeaderboard,
  fetchShopItems,
  getCurrentAuthUser,
  setAvatarCharacterId,
  setEquippedFrame,
  type AuthUser,
  type GlobalLeaderboardEntry,
  type LeaderboardEntry,
  type MatchMode,
  type QuizLeaderboardEntry,
  type RecentMatch,
  type ShopItem,
} from "@/lib/supabase";

const MODE_LABELS: Record<MatchMode, string> = {
  imu: "Gegen Imu",
  zufallsgegner: "Gegen Zufallsgegner",
  "live-draft": "Live-Draft",
};

// Achievements generalized beyond Fusion (Q142) — every mode's definitions
// write to the same achievement_id namespace in the `achievements` table
// (see migration 0010), so no schema change was needed to add these.
const ACHIEVEMENT_GROUPS = [
  { label: "Fusions-Pirat", items: FUSION_ACHIEVEMENTS },
  { label: "Duell", items: DUEL_ACHIEVEMENTS },
  { label: "Draft", items: DRAFT_ACHIEVEMENTS },
  { label: "Quiz", items: QUIZ_ACHIEVEMENTS },
  { label: "Crew Builder", items: CREW_ACHIEVEMENTS },
  { label: "Blind Ranking", items: BLIND_RANKING_ACHIEVEMENTS },
  { label: "Tierlisten", items: TIER_LIST_ACHIEVEMENTS },
];
const TOTAL_ACHIEVEMENTS = ACHIEVEMENT_GROUPS.reduce((sum, g) => sum + g.items.length, 0);

function avatarFor(id: string | null) {
  return id ? characters.find((c) => c.id === id) : null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

export function ProfileBoard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [equippedFrame, setEquippedFrameState] = useState<string | null>(null);
  const [equippedColor, setEquippedColorState] = useState<string | null>(null);
  const [equippedTitle, setEquippedTitleState] = useState<string | null>(null);
  const [berries, setBerries] = useState(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [quizLeaderboard, setQuizLeaderboard] = useState<QuizLeaderboardEntry[]>([]);
  const [recent, setRecent] = useState<RecentMatch[]>([]);
  const [matchFilter, setMatchFilter] = useState<MatchMode | "alle">("alle");
  const [globalLeaderboard, setGlobalLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      getCurrentAuthUser(),
      fetchMyLevelInfo(),
      fetchMyAchievements(),
      fetchShopItems(),
      fetchLeaderboard(),
      fetchQuizLeaderboard(),
      fetchMyRecentMatches(10),
      fetchGlobalLeaderboard(),
    ]).then(([authUser, levelInfo, achievements, items, board, quizBoard, matches, globalBoard]) => {
      setUser(authUser);
      setProgress(getLevelProgress(levelInfo?.xp ?? 0));
      setEquippedFrameState(levelInfo?.equippedFrame ?? null);
      setEquippedColorState(levelInfo?.equippedColor ?? null);
      setEquippedTitleState(levelInfo?.equippedTitle ?? null);
      setBerries(levelInfo?.berries ?? 0);
      setUnlockedAchievements(achievements);
      setShopItems(items);
      setAvatarId(authUser?.avatarCharacterId ?? null);
      setLeaderboard(board);
      setQuizLeaderboard(quizBoard);
      setRecent(matches);
      setGlobalLeaderboard(globalBoard);
      setLoaded(true);
      if (authUser?.username) {
        ensureProfile(authUser.username).then((p) => setShareCode(p?.share_code ?? null));
      }
    });
  }, []);

  if (!loaded) {
    return <LoadingSpinner label="Lade Profil…" />;
  }

  if (!user || !progress) {
    return <p className="text-sm text-black/50 dark:text-white/40">Melde dich an, um dein Profil zu sehen.</p>;
  }

  const avatar = avatarId ? characters.find((c) => c.id === avatarId) : null;
  const unlockedFrames = framesUnlockedAtLevel(progress.level);
  const shopFrames = shopItems.filter((i) => i.category === "frame");
  const shopColors = shopItems.filter((i) => i.category === "color");
  const shopTitles = shopItems.filter((i) => i.category === "title");
  const activeFrameClass =
    COSMETIC_FRAMES.find((f) => f.id === equippedFrame)?.className ??
    shopFrames.find((f) => f.id === equippedFrame)?.className ??
    "";
  const activeColorClass = shopColors.find((c) => c.id === equippedColor)?.className ?? "";
  const activeTitle = shopTitles.find((t) => t.id === equippedTitle);
  const myUserId = user.id;
  const myStats = leaderboard.find((e) => e.userId === myUserId);
  const filteredRecent = matchFilter === "alle" ? recent : recent.filter((m) => m.mode === matchFilter);

  async function equipFrame(frameId: string) {
    const applied = frameId === "none" ? null : frameId;
    setEquippedFrameState(applied);
    await setEquippedFrame(applied);
  }

  async function changeAvatar(characterId: string) {
    setAvatarId(characterId);
    await setAvatarCharacterId(characterId);
  }

  async function copyShareCode() {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      // clipboard unavailable — the code is still shown as selectable text
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="op-wanted op-parchment flex items-center gap-4 rounded-xl p-5">
        {avatar?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar.imageUrl}
            alt={avatar.name}
            referrerPolicy="no-referrer"
            className={`h-20 w-20 rounded-full object-cover object-top border-2 border-poster-ink ${activeFrameClass}`}
          />
        ) : (
          <span
            className={`flex h-20 w-20 items-center justify-center rounded-full border-2 border-poster-ink bg-accent/15 text-2xl font-bold ${activeFrameClass}`}
          >
            {user.username?.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div>
          <p className={`font-[family-name:var(--font-display)] text-xl ${activeColorClass}`}>{user.username}</p>
          {activeTitle && <p className={`text-sm ${activeTitle.className}`}>{activeTitle.label}</p>}
          <p className="font-[family-name:var(--font-display)] text-lg text-accent-ink">
            {progress.rankTitle} · Level {progress.level}
          </p>
          <p className="text-sm opacity-70">{formatBerry(berries)}</p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-black/50 dark:text-white/40">
          <span>{progress.xp.toLocaleString("de-DE")} XP</span>
          <span>
            {progress.levelEndXp.toLocaleString("de-DE")} XP für Level {progress.level + 1}
          </span>
        </div>
        <ProgressBar progress={progress.progress} size="lg" />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
          Avatar
        </h2>
        <div className="grid grid-cols-6 gap-2">
          {AVATAR_CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => changeAvatar(c.id)}
              title={c.name}
              className={`relative rounded-full overflow-hidden border-2 ${avatarId === c.id ? "border-accent" : "border-transparent"}`}
            >
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt={c.name} referrerPolicy="no-referrer" className="h-12 w-12 object-cover object-top" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
          Dein Freundescode
        </h2>
        <div className="flex items-center gap-2">
          <code className="op-card px-3 py-1.5 text-sm font-[family-name:var(--font-mono)] tracking-widest select-all">
            {shareCode ?? "…"}
          </code>
          <button
            onClick={copyShareCode}
            disabled={!shareCode}
            className="text-xs text-black/50 dark:text-white/40 hover:text-accent-ink hover:underline disabled:opacity-40"
          >
            {codeCopied ? "Kopiert!" : "Kopieren"}
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
          Freunde
        </h2>
        <FriendsPanel />
      </div>

      {myStats && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
            Deine Bilanz
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Card variant="plain" className="py-4">
              <p className="text-2xl font-bold text-success">{myStats.wins}</p>
              <p className="text-xs text-black/50 dark:text-white/40">Siege</p>
            </Card>
            <Card variant="plain" className="py-4">
              <p className="text-2xl font-bold text-danger">{myStats.losses}</p>
              <p className="text-xs text-black/50 dark:text-white/40">Niederlagen</p>
            </Card>
            <Card variant="plain" className="py-4">
              <p className="text-2xl font-bold text-accent-ink">
                {Math.round((myStats.wins / Math.max(1, myStats.wins + myStats.losses)) * 100)}%
              </p>
              <p className="text-xs text-black/50 dark:text-white/40">Winrate</p>
            </Card>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
              Letzte Partien
            </h2>
            <div className="flex gap-1.5">
              {(["alle", "imu", "zufallsgegner", "live-draft"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setMatchFilter(f)}
                  className={`rounded-full px-2.5 py-1 text-xs ${matchFilter === f ? "bg-accent text-poster-ink" : "border border-black/10 dark:border-white/10 text-black/50 dark:text-white/40"}`}
                >
                  {f === "alle" ? "Alle" : MODE_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
          <ul className="flex flex-col gap-1.5">
            {filteredRecent.map((m, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm">
                <span>
                  {MODE_LABELS[m.mode]}
                  {m.opponentLabel && <span className="text-black/50 dark:text-white/40"> vs. {m.opponentLabel}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className={m.result === "win" ? "text-success font-medium" : "text-danger font-medium"}>
                    {m.result === "win" ? "Sieg" : "Niederlage"}
                  </span>
                  <span className="text-black/40 dark:text-white/30 text-xs">{timeAgo(m.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
            Bestenliste
          </h2>
          <ol className="flex flex-col gap-1.5">
            {leaderboard.slice(0, 10).map((e, i) => {
              const a = avatarFor(e.avatarCharacterId);
              const isMe = e.userId === myUserId;
              return (
                <li key={e.userId} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isMe ? "bg-accent/10 border border-accent/30" : "border border-transparent"}`}>
                  <span className="w-5 text-right text-black/40 dark:text-white/30 font-[family-name:var(--font-mono)]">{i + 1}.</span>
                  {a?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageUrl} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover object-top" />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-accent/15" />
                  )}
                  <span className="flex-1 font-medium">
                    {e.username}
                    {isMe && " (du)"}
                  </span>
                  <span className="text-success">{e.wins}S</span>
                  <span className="text-danger">{e.losses}N</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {quizLeaderboard.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
            Quiz-Bestenliste
          </h2>
          <ol className="flex flex-col gap-1.5">
            {quizLeaderboard.slice(0, 10).map((e, i) => {
              const a = avatarFor(e.avatarCharacterId);
              const isMe = e.userId === myUserId;
              const pct = Math.round((e.totalScore / Math.max(1, e.totalQuestions)) * 100);
              return (
                <li key={e.userId} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isMe ? "bg-accent/10 border border-accent/30" : "border border-transparent"}`}>
                  <span className="w-5 text-right text-black/40 dark:text-white/30 font-[family-name:var(--font-mono)]">{i + 1}.</span>
                  {a?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageUrl} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover object-top" />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-accent/15" />
                  )}
                  <span className="flex-1 font-medium">
                    {e.username}
                    {isMe && " (du)"}
                  </span>
                  <span className="text-black/50 dark:text-white/40">
                    {pct}% ({e.quizzesPlayed} Quizze)
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {globalLeaderboard.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
            Globale Bestenliste (Level)
          </h2>
          <ol className="flex flex-col gap-1.5">
            {globalLeaderboard.slice(0, 10).map((e, i) => {
              const a = avatarFor(e.avatarCharacterId);
              const isMe = e.userId === myUserId;
              const level = getLevelProgress(e.xp).level;
              return (
                <li key={e.userId} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isMe ? "bg-accent/10 border border-accent/30" : "border border-transparent"}`}>
                  <span className="w-5 text-right text-black/40 dark:text-white/30 font-[family-name:var(--font-mono)]">{i + 1}.</span>
                  {a?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageUrl} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover object-top" />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-accent/15" />
                  )}
                  <span className="flex-1 font-medium">
                    {e.username}
                    {isMe && " (du)"}
                  </span>
                  <span className="text-black/50 dark:text-white/40">Level {level}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
          Profil-Rahmen
        </h2>
        <div className="flex flex-wrap gap-2">
          {COSMETIC_FRAMES.map((frame) => {
            const isUnlocked = unlockedFrames.some((f) => f.id === frame.id);
            const isActive = (equippedFrame ?? "none") === frame.id;
            return (
              <button
                key={frame.id}
                onClick={() => isUnlocked && equipFrame(frame.id)}
                disabled={!isUnlocked}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  isActive ? "border-accent bg-accent/10 font-semibold" : "border-black/15 dark:border-white/15"
                } ${!isUnlocked ? "opacity-40 cursor-not-allowed" : "hover:border-accent"}`}
              >
                {frame.label}
                {!isUnlocked && <span className="ml-1 text-xs">(ab Lv. {frame.minLevel})</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
          Shop
        </h2>
        <Link href="/shop">
          <Card variant="spotlight" accent="shop" className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              Rahmen, Farben, Avatare, Titel & Arenen kaufen
              <span className="block font-normal text-black/60 dark:text-white/50">{formatBerry(berries)} verfügbar</span>
            </span>
            <span className="text-accent-ink text-xl" aria-hidden>
              →
            </span>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
          Erfolge ({unlockedAchievements.size}/{TOTAL_ACHIEVEMENTS})
        </h2>
        <div className="flex flex-col gap-4">
          {ACHIEVEMENT_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="mb-1.5 text-xs font-semibold text-black/50 dark:text-white/40">{group.label}</h3>
              <ul className="flex flex-col gap-2">
                {group.items.map((a) => {
                  const unlocked = unlockedAchievements.has(a.id);
                  return (
                    <li key={a.id} className={`rounded-lg border p-3 text-sm ${unlocked ? "border-accent/50 bg-accent/5" : "border-black/10 dark:border-white/10 opacity-50"}`}>
                      <p className="font-medium">
                        {unlocked ? "🏆" : "🔒"} {a.label}
                      </p>
                      <p className="text-xs text-black/60 dark:text-white/50">{a.description}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
