"use client";

import { useEffect, useState } from "react";
import { characters } from "@/lib/characters";
import { AVATAR_CHOICES } from "@/lib/avatarChoices";
import {
  COSMETIC_FRAMES,
  framesUnlockedAtLevel,
  getLevelProgress,
  type LevelProgress,
} from "@/lib/levels";
import { FUSION_ACHIEVEMENTS } from "@/lib/fusionAchievements";
import { formatBerry } from "@/lib/fusionTraits";
import { LoadingSpinner } from "./LoadingSpinner";
import { FriendsPanel } from "./FriendsPanel";
import { Card } from "./ui/Card";
import { ProgressBar } from "./ui/ProgressBar";
import {
  ensureProfile,
  equipShopItem,
  fetchLeaderboard,
  fetchMyAchievements,
  fetchMyLevelInfo,
  fetchMyRecentMatches,
  fetchMyShopPurchases,
  fetchQuizLeaderboard,
  fetchShopItems,
  getCurrentAuthUser,
  purchaseShopItem,
  setAvatarCharacterId,
  setEquippedColor,
  setEquippedFrame,
  type AuthUser,
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
  const [berries, setBerries] = useState(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());
  const [shopBusyId, setShopBusyId] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [quizLeaderboard, setQuizLeaderboard] = useState<QuizLeaderboardEntry[]>([]);
  const [recent, setRecent] = useState<RecentMatch[]>([]);
  const [matchFilter, setMatchFilter] = useState<MatchMode | "alle">("alle");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      getCurrentAuthUser(),
      fetchMyLevelInfo(),
      fetchMyAchievements(),
      fetchShopItems(),
      fetchMyShopPurchases(),
      fetchLeaderboard(),
      fetchQuizLeaderboard(),
      fetchMyRecentMatches(10),
    ]).then(([authUser, levelInfo, achievements, items, purchases, board, quizBoard, matches]) => {
      setUser(authUser);
      setProgress(getLevelProgress(levelInfo?.xp ?? 0));
      setEquippedFrameState(levelInfo?.equippedFrame ?? null);
      setEquippedColorState(levelInfo?.equippedColor ?? null);
      setBerries(levelInfo?.berries ?? 0);
      setUnlockedAchievements(achievements);
      setShopItems(items);
      setOwnedItems(purchases);
      setAvatarId(authUser?.avatarCharacterId ?? null);
      setLeaderboard(board);
      setQuizLeaderboard(quizBoard);
      setRecent(matches);
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
  const activeFrameClass =
    COSMETIC_FRAMES.find((f) => f.id === equippedFrame)?.className ??
    shopFrames.find((f) => f.id === equippedFrame)?.className ??
    "";
  const activeColorClass = shopColors.find((c) => c.id === equippedColor)?.className ?? "";
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

  async function handleShopAction(item: ShopItem) {
    if (shopBusyId) return;
    const owned = ownedItems.has(item.id);
    const isEquipped = item.category === "frame" ? equippedFrame === item.id : equippedColor === item.id;
    setShopBusyId(item.id);
    try {
      if (!owned) {
        const ok = await purchaseShopItem(item.id);
        if (ok) {
          setOwnedItems((prev) => new Set(prev).add(item.id));
          setBerries((b) => b - item.price);
        }
        return;
      }
      if (isEquipped) {
        if (item.category === "frame") {
          setEquippedFrameState(null);
          await setEquippedFrame(null);
        } else if (item.category === "color") {
          setEquippedColorState(null);
          await setEquippedColor(null);
        }
        return;
      }
      const ok = await equipShopItem(item.id);
      if (ok) {
        if (item.category === "frame") setEquippedFrameState(item.id);
        else if (item.category === "color") setEquippedColorState(item.id);
      }
    } finally {
      setShopBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <Card variant="framed" className="flex items-center gap-4 p-5">
        {avatar?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar.imageUrl}
            alt={avatar.name}
            referrerPolicy="no-referrer"
            className={`h-20 w-20 rounded-full object-cover object-top border border-black/10 dark:border-white/10 ${activeFrameClass}`}
          />
        ) : (
          <span
            className={`flex h-20 w-20 items-center justify-center rounded-full bg-accent/15 text-2xl font-bold text-accent ${activeFrameClass}`}
          >
            {user.username?.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div>
          <p className={`text-xl font-semibold ${activeColorClass}`}>{user.username}</p>
          <p className="font-[family-name:var(--font-display)] text-lg text-accent">
            {progress.rankTitle} · Level {progress.level}
          </p>
          <p className="text-sm text-black/60 dark:text-white/50">{formatBerry(berries)}</p>
        </div>
      </Card>

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
            className="text-xs text-black/50 dark:text-white/40 hover:text-accent hover:underline disabled:opacity-40"
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
              <p className="text-2xl font-bold text-accent">
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
                  className={`rounded-full px-2.5 py-1 text-xs ${matchFilter === f ? "bg-accent text-white" : "border border-black/10 dark:border-white/10 text-black/50 dark:text-white/40"}`}
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
          Shop: Rahmen
        </h2>
        <div className="flex flex-wrap gap-2">
          {shopFrames.map((item) => {
            const owned = ownedItems.has(item.id);
            const isActive = equippedFrame === item.id;
            const isLocked = progress.level < item.minLevel;
            return (
              <button
                key={item.id}
                onClick={() => !isLocked && handleShopAction(item)}
                disabled={isLocked || shopBusyId === item.id}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  isActive ? "border-accent bg-accent/10 font-semibold" : "border-black/15 dark:border-white/15"
                } ${isLocked ? "opacity-40 cursor-not-allowed" : "hover:border-accent"}`}
              >
                {item.label}
                {isLocked ? (
                  <span className="ml-1 text-xs">(ab Lv. {item.minLevel})</span>
                ) : (
                  <span className="ml-1 text-xs">{owned ? (isActive ? "· ausgerüstet" : "· ausrüsten") : `· ${formatBerry(item.price)}`}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
          Shop: Namensfarbe
        </h2>
        <div className="flex flex-wrap gap-2">
          {shopColors.map((item) => {
            const owned = ownedItems.has(item.id);
            const isActive = equippedColor === item.id;
            const isLocked = progress.level < item.minLevel;
            return (
              <button
                key={item.id}
                onClick={() => !isLocked && handleShopAction(item)}
                disabled={isLocked || shopBusyId === item.id}
                className={`rounded-md border px-3 py-1.5 text-sm ${item.className} ${
                  isActive ? "border-accent bg-accent/10 font-semibold" : "border-black/15 dark:border-white/15"
                } ${isLocked ? "opacity-40 cursor-not-allowed" : "hover:border-accent"}`}
              >
                {item.label}
                {isLocked ? (
                  <span className="ml-1 text-xs">(ab Lv. {item.minLevel})</span>
                ) : (
                  <span className="ml-1 text-xs">{owned ? (isActive ? "· ausgerüstet" : "· ausrüsten") : `· ${formatBerry(item.price)}`}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
          Fusions-Pirat-Erfolge ({unlockedAchievements.size}/{FUSION_ACHIEVEMENTS.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {FUSION_ACHIEVEMENTS.map((a) => {
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
    </div>
  );
}
