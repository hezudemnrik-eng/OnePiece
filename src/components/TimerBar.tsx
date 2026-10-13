type Props = {
  secondsLeft: number;
  totalSeconds: number;
};

export function TimerBar({ secondsLeft, totalSeconds }: Props) {
  const pct = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));
  const low = secondsLeft <= 5;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${low ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-mono tabular-nums">{secondsLeft}s</span>
    </div>
  );
}
