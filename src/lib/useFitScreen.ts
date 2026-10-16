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
  const [fit, setFit] = useState({ wrapperHeight: null as number | null, scale: 1, widthPct: 100 });

  useLayoutEffect(() => {
    function recalc() {
      if (!contentRef.current || window.innerWidth >= 768) {
        setFit({ wrapperHeight: null, scale: 1, widthPct: 100 });
        return;
      }
      const el = contentRef.current;
      const headerH = document.getElementById(headerId)?.offsetHeight ?? 0;
      const footerH = document.getElementById(footerId)?.offsetHeight ?? 0;
      const available = window.innerHeight - headerH - footerH;
      if (available <= 0) return;

      // No floor (and, below, no ceiling either) on the scale: "kein
      // Scrollen" is a hard requirement, so the page must always fit even on
      // the most cramped viewports, and on a roomier viewport the mockup
      // packs content edge-to-edge down to the bottom bar rather than
      // leaving a gap — so content scales up to fill the space too, not
      // just down to avoid overflowing it. Scaling (rather than flex-growing
      // individual sections) reuses one simple, already-proven mechanism
      // instead of a flex-grow/grid-fr measurement cycle that fights the
      // very ResizeObserver driving this recalc.
      //
      // transform:scale stretches width along with height, so the caller
      // narrows the box by widthPct (100/scale) to cancel that out — see
      // FitScreen.tsx. But narrowing the box changes how its text wraps,
      // which changes its natural scrollHeight, which changes the scale
      // needed, which changes widthPct again — on a short-content view
      // (the Live-Draft lobby forms) that fed back into the very
      // ResizeObserver driving this recalc and oscillated forever between
      // two line-wrap states instead of settling. Two fixed-point passes,
      // each measuring scrollHeight at the width the previous pass
      // settled on, converges close enough without looping against the
      // observer. (The non-oscillating alternative — scaling height only
      // via scaleY — was rejected: it stretches text/buttons vertically
      // instead of keeping them proportional.)
      let widthPct = 100;
      let scale = 1;
      let natural = 0;
      for (let pass = 0; pass < 2; pass++) {
        const prevWidth = el.style.width;
        el.style.width = `${widthPct}%`;
        natural = el.scrollHeight;
        el.style.width = prevWidth;
        if (natural <= 0) return;
        scale = available / natural;
        widthPct = 100 / scale;
      }
      // The two passes above assume natural height barely changes with
      // width (true for text reflow, the case they were written for). For
      // content whose height scales strongly with width instead — e.g. a
      // grid of aspect-ratio image cards, like Fusion Pirates' 7-category
      // result grid — two passes don't converge: each narrower width still
      // yields a visibly shorter natural height than the previous pass
      // assumed, so the chosen scale still overflows `available` and the
      // content's end (e.g. its "nochmal spielen" button) renders clipped
      // behind the footer instead of above it. Keep re-measuring at the
      // narrower width and clamping the scale down until it actually fits
      // (bounded so content that never stabilizes still stops at some
      // point) — a no-op correction whenever the 2 passes above already
      // converged well (Home/Live-Draft).
      for (let guard = 0; guard < 8; guard++) {
        const prevWidth = el.style.width;
        el.style.width = `${widthPct}%`;
        const finalNatural = el.scrollHeight;
        el.style.width = prevWidth;
        if (finalNatural <= 0 || finalNatural * scale <= available + 0.5) break;
        scale = available / finalNatural;
        widthPct = 100 / scale;
      }
      el.style.width = `${widthPct}%`; // matches the inline style setFit below will render, so there's no flash back to the pre-pass width
      setFit({ wrapperHeight: Math.round(available), scale, widthPct });
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
