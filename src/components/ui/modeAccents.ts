/**
 * Per-mode accent color lookup (Q29). Class names are written out in full
 * (never built via template-string interpolation) so Tailwind's v4 content
 * scanner — which only picks up complete utility strings it can find as
 * literal text — actually generates the CSS for each one. The color values
 * themselves live in globals.css as --mode-* tokens.
 */
export type ModeAccent =
  | "accent"
  | "draft"
  | "duell"
  | "zufallsgegner"
  | "imu"
  | "quiz"
  | "tierlisten"
  | "blind-ranking"
  | "crew"
  | "fusion";

type AccentClasses = {
  text: string;
  border: string;
  borderSoft: string;
  bgSoft: string;
  fromSoft: string;
};

export const MODE_ACCENT_CLASSES: Record<ModeAccent, AccentClasses> = {
  accent: {
    text: "text-accent",
    border: "border-accent",
    borderSoft: "border-accent/40",
    bgSoft: "bg-accent/10",
    fromSoft: "from-accent/10",
  },
  draft: {
    text: "text-mode-draft",
    border: "border-mode-draft",
    borderSoft: "border-mode-draft/40",
    bgSoft: "bg-mode-draft/10",
    fromSoft: "from-mode-draft/10",
  },
  duell: {
    text: "text-mode-duell",
    border: "border-mode-duell",
    borderSoft: "border-mode-duell/40",
    bgSoft: "bg-mode-duell/10",
    fromSoft: "from-mode-duell/10",
  },
  zufallsgegner: {
    text: "text-mode-zufallsgegner",
    border: "border-mode-zufallsgegner",
    borderSoft: "border-mode-zufallsgegner/40",
    bgSoft: "bg-mode-zufallsgegner/10",
    fromSoft: "from-mode-zufallsgegner/10",
  },
  imu: {
    text: "text-mode-imu",
    border: "border-mode-imu",
    borderSoft: "border-mode-imu/40",
    bgSoft: "bg-mode-imu/10",
    fromSoft: "from-mode-imu/10",
  },
  quiz: {
    text: "text-mode-quiz",
    border: "border-mode-quiz",
    borderSoft: "border-mode-quiz/40",
    bgSoft: "bg-mode-quiz/10",
    fromSoft: "from-mode-quiz/10",
  },
  tierlisten: {
    text: "text-mode-tierlisten",
    border: "border-mode-tierlisten",
    borderSoft: "border-mode-tierlisten/40",
    bgSoft: "bg-mode-tierlisten/10",
    fromSoft: "from-mode-tierlisten/10",
  },
  "blind-ranking": {
    text: "text-mode-blind-ranking",
    border: "border-mode-blind-ranking",
    borderSoft: "border-mode-blind-ranking/40",
    bgSoft: "bg-mode-blind-ranking/10",
    fromSoft: "from-mode-blind-ranking/10",
  },
  crew: {
    text: "text-mode-crew",
    border: "border-mode-crew",
    borderSoft: "border-mode-crew/40",
    bgSoft: "bg-mode-crew/10",
    fromSoft: "from-mode-crew/10",
  },
  fusion: {
    text: "text-mode-fusion",
    border: "border-mode-fusion",
    borderSoft: "border-mode-fusion/40",
    bgSoft: "bg-mode-fusion/10",
    fromSoft: "from-mode-fusion/10",
  },
};
