"use client";

import Link from "next/link";
import { MODES, type ModeGroupId } from "@/lib/modes";
import { ICON_IMAGES } from "@/lib/iconImages";
import { Card } from "@/components/ui/Card";
import { setLastPlayedHref } from "@/lib/lastPlayed";

type Props = {
  group: ModeGroupId;
  /** The "kampf" group keeps Solo and Live visibly separate (Q54). */
  splitSoloLive?: boolean;
};

/** Illustrated artwork (Boss's ChatGPT assets) for sub-modes that have one yet — others fall back to the plain emoji card. */
const MODE_IMAGES: Record<string, string> = {
  "/draft/live": "/images/mode-live-draft.jpg",
  "/imu": "/images/mode-imu.jpg",
  "/quiz": "/images/mode-quiz.jpg",
  "/blind-ranking": "/images/mode-blind-ranking.jpg",
  "/tierlisten": "/images/mode-tierlisten.jpg",
  "/fusion": "/images/mode-fusion.jpg",
  "/crew": "/images/mode-crew.jpg",
};

function ModeGrid({ modes }: { modes: typeof MODES }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {modes.map((m) => {
        const image = MODE_IMAGES[m.href];
        if (image) {
          return (
            <Link key={m.href} href={m.href} className="group" onClick={() => setLastPlayedHref(m.href)}>
              <div
                className="relative flex h-full min-h-[160px] flex-col justify-end overflow-hidden rounded-xl border bg-cover bg-center p-4 shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition group-hover:-translate-y-0.5 group-hover:shadow-lg"
                style={{
                  borderColor: `color-mix(in srgb, var(--mode-${m.accent}) 55%, transparent)`,
                  backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.1)), url('${image}')`,
                }}
              >
                <span className="text-base font-semibold leading-tight text-white">{m.title}</span>
                <span className="text-sm text-white/70 leading-snug">{m.desc}</span>
              </div>
            </Link>
          );
        }
        return (
          <Link key={m.href} href={m.href} className="group" onClick={() => setLastPlayedHref(m.href)}>
            <Card
              variant="spotlight"
              accent={m.accent}
              className="h-full min-h-[160px] flex flex-col gap-1.5 justify-center transition group-hover:-translate-y-0.5 group-hover:shadow-lg"
            >
              {ICON_IMAGES[m.icon] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ICON_IMAGES[m.icon]} alt="" aria-hidden className="h-16 w-16 object-contain drop-shadow-md" />
              ) : (
                <span className="text-4xl drop-shadow-md" aria-hidden>
                  {m.icon}
                </span>
              )}
              <span className="text-base font-semibold leading-tight">{m.title}</span>
              <span className="text-sm text-black/60 dark:text-white/50 leading-snug">{m.desc}</span>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

/** Scoped mode grid for one of the 3 bottom-nav categories — kept small on purpose (no scroll). */
export function CategoryHub({ group, splitSoloLive }: Props) {
  const modes = MODES.filter((m) => m.group === group);

  if (!splitSoloLive) {
    return <ModeGrid modes={modes} />;
  }

  const solo = modes.filter((m) => !m.live);
  const live = modes.filter((m) => m.live);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-black/50 dark:text-white/40">Solo</h2>
        <ModeGrid modes={solo} />
      </div>
      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-black/50 dark:text-white/40">Live</h2>
        <ModeGrid modes={live} />
      </div>
    </div>
  );
}
