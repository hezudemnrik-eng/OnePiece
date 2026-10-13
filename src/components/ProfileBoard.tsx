"use client";

import { useEffect, useState } from "react";
import { characters } from "@/lib/characters";
import {
  COSMETIC_FRAMES,
  framesUnlockedAtLevel,
  getLevelProgress,
  type LevelProgress,
} from "@/lib/levels";
import { FUSION_ACHIEVEMENTS } from "@/lib/fusionAchievements";
import {
  fetchMyAchievements,
  fetchMyLevelInfo,
  getCurrentAuthUser,
  setEquippedFrame,
  type AuthUser,
} from "@/lib/supabase";

export function ProfileBoard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [equippedFrame, setEquippedFrameState] = useState<string | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getCurrentAuthUser(), fetchMyLevelInfo(), fetchMyAchievements()]).then(
      ([authUser, levelInfo, achievements]) => {
        setUser(authUser);
        setProgress(getLevelProgress(levelInfo?.xp ?? 0));
        setEquippedFrameState(levelInfo?.equippedFrame ?? null);
        setUnlockedAchievements(achievements);
        setLoaded(true);
      }
    );
  }, []);

  if (!loaded) {
    return <p className="text-sm text-black/50 dark:text-white/40">Lade Profil…</p>;
  }

  if (!user || !progress) {
    return <p className="text-sm text-black/50 dark:text-white/40">Melde dich an, um dein Profil zu sehen.</p>;
  }

  const avatar = user.avatarCharacterId ? characters.find((c) => c.id === user.avatarCharacterId) : null;
  const unlockedFrames = framesUnlockedAtLevel(progress.level);
  const activeFrameClass = COSMETIC_FRAMES.find((f) => f.id === equippedFrame)?.className ?? "";

  async function equipFrame(frameId: string) {
    const applied = frameId === "none" ? null : frameId;
    setEquippedFrameState(applied);
    await setEquippedFrame(applied);
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center gap-4">
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
            className={`flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15 text-2xl font-bold text-amber-700 dark:text-amber-400 ${activeFrameClass}`}
          >
            {user.username?.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div>
          <p className="text-xl font-semibold">{user.username}</p>
          <p className="font-[family-name:var(--font-display)] text-lg text-amber-700 dark:text-amber-400">
            {progress.rankTitle} · Level {progress.level}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-black/50 dark:text-white/40">
          <span>{progress.xp.toLocaleString("de-DE")} XP</span>
          <span>
            {progress.levelEndXp.toLocaleString("de-DE")} XP für Level {progress.level + 1}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-amber-500 transition-[width]"
            style={{ width: `${Math.round(progress.progress * 100)}%` }}
          />
        </div>
      </div>

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
                  isActive
                    ? "border-amber-500 bg-amber-500/10 font-semibold"
                    : "border-black/15 dark:border-white/15"
                } ${!isUnlocked ? "opacity-40 cursor-not-allowed" : "hover:border-amber-500"}`}
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
          Fusions-Pirat-Erfolge ({unlockedAchievements.size}/{FUSION_ACHIEVEMENTS.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {FUSION_ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedAchievements.has(a.id);
            return (
              <li
                key={a.id}
                className={`rounded-lg border p-3 text-sm ${
                  unlocked
                    ? "border-amber-500/50 bg-amber-500/5"
                    : "border-black/10 dark:border-white/10 opacity-50"
                }`}
              >
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
