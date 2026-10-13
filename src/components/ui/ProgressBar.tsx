type Size = "sm" | "md" | "lg";

type Props = {
  /** 0–1. Values outside that range are clamped. */
  progress: number;
  size?: Size;
  /** Full Tailwind class for the fill color, e.g. "bg-accent" or "bg-danger". */
  fillClassName?: string;
  className?: string;
  /** Animate width changes (disable for per-tick timers that already animate via CSS duration tricks elsewhere). */
  animated?: boolean;
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

/**
 * Shared progress track. Generalizes the three places that used to hand-roll
 * their own bar (XP progress in ProfileBoard, TimerBar's countdown, the quiz
 * question-progress indicator).
 */
export function ProgressBar({
  progress,
  size = "md",
  fillClassName = "bg-accent",
  className = "",
  animated = true,
}: Props) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10 ${SIZE_CLASSES[size]} ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${fillClassName} ${animated ? "transition-[width] duration-300 ease-out" : ""}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
