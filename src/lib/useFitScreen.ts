"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Scales a block of content down (never up) so it fits, with zero
 * scrolling, in the space between a header/footer and the viewport height —
 * for pages where "fits on one screen" is a hard requirement on every phone
 * size rather than something tuned to one breakpoint (Home's profile card,
 * PR #80; the Live-Draft board, PR #81).
 *
 * transform:scale is visual-only, so the wrapper height a caller renders
 * around `contentRef` must also collapse to the post-scale height — see
 * `fit.wrapperHeight` — or a gap (or overlap) appears where the unscaled
 * space used to be.
 *
 * A one-shot measurement on mount races images that haven't loaded yet
 * (header/nav reads 0px before banner/icon images decode), so a
 * ResizeObserver watches the measured elements and re-measures on any
 * later height change — including the content's own height changing as
 * the caller's state/phase changes, with no extra deps needed.
 */
export function useFitScreen(headerId = "app-header", footerId = "app-bottomnav") {
  const contentRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ wrapperHeight: null as number | null, scale: 1 });

  useLayoutEffect(() => {
    function recalc() {
      if (!contentRef.current || window.innerWidth >= 768) {
        setFit({ wrapperHeight: null, scale: 1 });
        return;
      }
      const headerH = document.getElementById(headerId)?.offsetHeight ?? 0;
      const footerH = document.getElementById(footerId)?.offsetHeight ?? 0;
      const available = window.innerHeight - headerH - footerH;
      const natural = contentRef.current.scrollHeight;
      // No floor on the scale: "kein Scrollen" is a hard requirement, so the
      // page must always fit even on the most cramped viewports (small
      // phone + browser toolbars), ahead of any minimum-legibility preference.
      const scale = natural > available ? available / natural : 1;
      setFit({ wrapperHeight: Math.round(natural * scale), scale });
    }
    recalc();
    const ro = new ResizeObserver(recalc);
    if (contentRef.current) ro.observe(contentRef.current);
    const headerEl = document.getElementById(headerId);
    const footerEl = document.getElementById(footerId);
    if (headerEl) ro.observe(headerEl);
    if (footerEl) ro.observe(footerEl);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [headerId, footerId]);

  return { contentRef, fit };
}
