import type { ButtonHTMLAttributes } from "react";

type State = "idle" | "correct" | "incorrect" | "muted";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  state?: State;
};

const STATE_CLASSES: Record<State, string> = {
  idle: "border-black/15 dark:border-white/15 hover:border-mode-quiz/50",
  correct: "border-success bg-success/15 font-semibold",
  incorrect: "border-danger bg-danger/15",
  muted: "border-black/10 dark:border-white/10 opacity-50 cursor-default",
};

/**
 * Single multiple-choice answer button, with its correct/incorrect/muted-
 * while-waiting states. Replaces the identical ~10-line className string
 * that used to be copy-pasted between QuizSoloBoard and QuizLiveBoard.
 */
export function AnswerOption({ state = "idle", children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={`flex items-center justify-between gap-2 rounded-md border px-4 py-2.5 text-left text-sm transition ${STATE_CLASSES[state]}`}
      {...rest}
    >
      <span>{children}</span>
      {state === "correct" && <span aria-hidden>✓</span>}
      {state === "incorrect" && <span aria-hidden>✗</span>}
    </button>
  );
}
