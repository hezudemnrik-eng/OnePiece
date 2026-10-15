"use client";

import type { ReactNode } from "react";
import { useFitScreen } from "@/lib/useFitScreen";

/** Wraps page content so it scales down to fit one screen with zero scrolling — see useFitScreen. */
export function FitScreen({ children }: { children: ReactNode }) {
  const { contentRef, fit } = useFitScreen();
  return (
    <div style={fit.wrapperHeight != null ? { height: fit.wrapperHeight, overflow: "hidden" } : undefined}>
      <div
        ref={contentRef}
        style={{
          transform: `scale(${fit.scale})`,
          transformOrigin: "top center",
          // transform:scale stretches width exactly like height — on a
          // screen whose natural content is much shorter than the
          // available space (e.g. the Live-Draft lobby forms, which
          // Boss said were "nicht in Ordnung" on his real phone) this
          // scaled the content wider than the viewport too, and the
          // wrapper's overflow:hidden above then clipped it, cutting off
          // text/buttons on both edges instead of just filling height.
          // Narrowing the box by the inverse factor before scaling
          // cancels the horizontal side effect out, so only the height
          // grows/shrinks, which is what "fit the vertical space" means
          // (fit.widthPct is that inverse factor — see useFitScreen).
          width: `${fit.widthPct}%`,
          marginInline: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
