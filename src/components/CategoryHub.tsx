import Link from "next/link";
import { MODES, type ModeGroupId } from "@/lib/modes";
import { Card } from "@/components/ui/Card";

type Props = {
  group: ModeGroupId;
  /** The "kampf" group keeps Solo and Live visibly separate (Q54). */
  splitSoloLive?: boolean;
};

function ModeGrid({ modes }: { modes: typeof MODES }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {modes.map((m) => (
        <Link key={m.href} href={m.href} className="group">
          <Card
            variant="spotlight"
            accent={m.accent}
            className="h-full flex flex-col gap-1 transition group-hover:-translate-y-0.5 group-hover:shadow-lg"
          >
            <span className="text-2xl" aria-hidden>
              {m.icon}
            </span>
            <span className="text-sm font-semibold leading-tight">{m.title}</span>
            <span className="text-xs text-black/60 dark:text-white/50 leading-snug">{m.desc}</span>
          </Card>
        </Link>
      ))}
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
