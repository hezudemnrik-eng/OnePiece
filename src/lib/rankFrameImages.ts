// Illustrated rank-frame artwork (Boss's ChatGPT assets) for the square
// profile-hero card. Unlike the avatar frames in frameImages.ts (a ring
// drawn around a round avatar), these are 9-slice borders drawn around a
// rectangular card via CSS border-image — see the .op-rank-frame rule in
// globals.css. A frame without an entry here keeps the plain CSS
// border/glow fallback from COSMETIC_FRAMES.className in src/lib/levels.ts.
export const RANK_FRAME_IMAGES: Record<string, string> = {};
