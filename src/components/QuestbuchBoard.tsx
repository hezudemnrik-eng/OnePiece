"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTodaysChallenge, type DailyChallenge } from "@/lib/dailyChallenge";
import { DAILY_QUEST_BERRY_BONUS, DAILY_QUEST_XP_BONUS } from "@/lib/levels";
import { BERRY_ICON, ICON_IMAGES } from "@/lib/iconImages";
import { Card } from "./ui/Card";
import { LoadingSpinner } from "./LoadingSpinner";
import { fetchDailyQuestClaimedToday, isSupabaseConfigured } from "@/lib/supabase";

export function QuestbuchBoard() {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [loaded, setLoaded] = useState(() => !isSupabaseConfigured());

  useEffect(() => {
    // Deferred a tick, same reasoning as HomeOverview: Date access has to
    // stay strictly client-only, not during server/static prerendering.
    Promise.resolve().then(() => setChallenge(getTodaysChallenge()));
    if (!isSupabaseConfigured()) return;
    fetchDailyQuestClaimedToday().then((done) => {
      setClaimed(done);
      setLoaded(true);
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="op-card relative flex min-h-[140px] flex-col justify-end overflow-hidden bg-cover bg-center p-4"
        style={{ backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.1)), url('/images/questbuch-header.jpg')" }}
      >
        <p className="text-sm font-semibold text-white">Dein Questbuch</p>
        <p className="text-xs text-white/70">Jeden Tag eine neue Herausforderung.</p>
      </div>

      {!challenge || !loaded ? (
        <LoadingSpinner />
      ) : (
        <Card variant="spotlight" accent={challenge.accent} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {ICON_IMAGES[challenge.icon] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ICON_IMAGES[challenge.icon]} alt="" aria-hidden className="h-10 w-10 shrink-0 object-contain drop-shadow-md" />
            ) : (
              <span className="shrink-0 text-2xl" aria-hidden>
                {challenge.icon}
              </span>
            )}
            <p className="font-medium">{challenge.text}</p>
          </div>

          <div className="flex items-center gap-2 text-sm text-black/60 dark:text-white/50">
            <span>Belohnung:</span>
            <span className="font-semibold">+{DAILY_QUEST_XP_BONUS} XP</span>
            <span className="inline-flex items-center gap-1 font-semibold">
              +{DAILY_QUEST_BERRY_BONUS}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BERRY_ICON} alt="Berry" className="h-4 w-4 object-contain" />
            </span>
          </div>

          {claimed ? (
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              ✅ Heute schon erledigt — morgen gibt es eine neue Quest.
            </p>
          ) : (
            <Link
              href={challenge.href}
              className="op-s-tier-glow inline-block rounded-lg border border-[color-mix(in_srgb,var(--foreground)_35%,transparent)] bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-ink shadow-[0_2px_6px_rgba(0,0,0,0.2)]"
            >
              Jetzt spielen
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
