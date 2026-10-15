"use client";

import type { ReactNode } from "react";
import { useFitScreen } from "@/lib/useFitScreen";

/** Wraps page content so it scales down to fit one screen with zero scrolling — see useFitScreen. */
export function FitScreen({ children }: { children: ReactNode }) {
  const { contentRef, fit } = useFitScreen();
  return (
    <div style={fit.wrapperHeight != null ? { height: fit.wrapperHeight, overflow: "hidden" } : undefined}>
      <div ref={contentRef} style={{ transform: `scale(${fit.scale})`, transformOrigin: "top center" }}>
        {children}
      </div>
    </div>
  );
}
