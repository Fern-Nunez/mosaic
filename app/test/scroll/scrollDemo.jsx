"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./scroll.css";

// WebGL cannot be server-rendered, and in Next 16 `ssr: false` is only
// allowed inside a Client Component.
const Assembly = dynamic(() => import("./assembly"), { ssr: false });

/**
 * The scroll story: disconnected and grey, then connected and in colour.
 *
 * The canvas is pinned for the length of the scroll and ScrollTrigger writes
 * 0..1 into a ref. The scene reads that ref inside its own frame loop, so
 * scrolling never triggers a React render — which is the difference between
 * this being smooth and it being a slideshow.
 */

/**
 * Numeric overrides from the query string, so values can be tried without an
 * edit-and-rebuild cycle: /test/scroll?flatten=0.3&aspect=0.9&count=5
 */
function useQueryTuning(defaults) {
  const params = useSearchParams();

  return useMemo(() => {
    const next = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const raw = params.get(key);
      if (raw !== null && raw !== "" && Number.isFinite(Number(raw))) {
        next[key] = Number(raw);
      }
    }
    return next;
  }, [params, defaults]);
}

/** True below the breakpoint. Starts false and corrects on mount. */
function useIsNarrow(breakpoint = 768) {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [breakpoint]);

  return narrow;
}

const DEFAULTS = {
  flatten: 0.3,
  aspect: 0.9,
  count: 5,
  seed: 12,
  spread: 1,
  stagger: 0.35,
  zoom: 1,
  /** Scroll distance the story takes, as a percentage of viewport height. */
  end: 70,
  scrub: 0.3,
  /** Progress percentage at which the copy swaps over. */
  swapAt: 55,
  /** Seconds the copy takes to cross-fade, independent of scroll speed. */
  swapDuration: 0.4,
};

/**
 * Narrow-screen overrides.
 *
 * Covering the band's full width on a phone pushes the camera a long way
 * back, so the same settings that fill a desktop leave a thin strip here.
 * zoom and flatten are the two that fix it without touching the layout —
 * changing aspect or count would give a different pattern on mobile.
 */
const MOBILE = {
  zoom: 1.35,
  flatten: 0.45,
};

export default function ScrollDemo() {
  const narrow = useIsNarrow();
  const base = useMemo(
    () => (narrow ? { ...DEFAULTS, ...MOBILE } : DEFAULTS),
    [narrow]
  );
  // Query params win over both, so any value can still be tried directly.
  const tuning = useQueryTuning(base);

  const progress = useRef(0);
  const stageRef = useRef(null);
  const firstRef = useRef(null);
  const secondRef = useRef(null);
  const readoutRef = useRef(null);
  const swapped = useRef(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const threshold = tuning.swapAt / 100;
    const duration = tuning.swapDuration;
    swapped.current = false;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: stageRef.current,
        start: "top top",
        end: `+=${tuning.end}%`,
        pin: true,
        scrub: tuning.scrub,
        onUpdate: (self) => {
          progress.current = self.progress;

          // The copy is NOT scrubbed. It flips once, when progress crosses
          // the threshold, and then plays out over its own fixed duration —
          // so the words read at a steady speed no matter how fast or slow
          // the page is being scrolled.
          const past = self.progress >= threshold;
          if (past !== swapped.current) {
            swapped.current = past;
            gsap.to(firstRef.current, { opacity: past ? 0 : 1, duration });
            gsap.to(secondRef.current, { opacity: past ? 1 : 0, duration });
          }

          // Written straight to the DOM; going through state here would
          // re-render the whole tree on every scroll frame.
          if (readoutRef.current) {
            readoutRef.current.textContent = `progress ${Math.round(
              self.progress * 100
            )}% · swaps at ${tuning.swapAt}% · end ${tuning.end}%`;
          }
        },
      });
    }, stageRef);

    return () => ctx.revert();
  }, [tuning.end, tuning.scrub, tuning.swapAt, tuning.swapDuration]);

  return (
    <main className="scrollRoot">
      <section className="scrollIntro">
        <h1>Five apps. Five logins.</h1>
        <p>Scroll.</p>
      </section>

      <section ref={stageRef} className="scrollStage">
        <div className="scrollCanvas">
          <Assembly progress={progress} {...tuning} />
        </div>

        {/* Both blocks share one grid cell, so the swap cannot shift layout. */}
        <div className="scrollCopy">
          <div ref={firstRef} className="scrollBlock">
            <h2>Does this sound familiar?</h2>
            <p>
              A budgeting app here, a calorie counter there, a habit tracker you
              keep forgetting to open.
            </p>
          </div>

          <div ref={secondRef} className="scrollBlock scrollBlockSecond">
            <h2>Finally, One Place where Everything is Connected</h2>
            <p>
              When your money, food, training and mood live side by side, the
              patterns finally show up.
            </p>
          </div>
        </div>

        <p ref={readoutRef} className="scrollReadout" />
      </section>

      <section className="scrollOutro">
        <h2>And on you go.</h2>
      </section>
    </main>
  );
}
