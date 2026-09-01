"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./loader.css";
import { markDismissed, onReady } from "./ready";

/**
 * Full-screen black hold until the 3D is actually up.
 *
 * Progress is built from milestones rather than from THREE's loading
 * manager: this scene loads no files — the geometry is generated, the
 * materials are procedural, the environment is lightformers — so
 * drei's useProgress would have nothing to measure and would jump 0 → 100.
 *
 * The four steps below are the things that genuinely take time. The number
 * shown is eased toward the true value so it counts up smoothly, but it can
 * never run ahead of it, and only reaches 100 when the scene is really ready.
 */

/** Weights sum to 100. `frames` is last because shaders compile on first draw. */
const STEPS = [
  { key: "chunk", weight: 45 },
  { key: "fonts", weight: 15 },
  { key: "canvas", weight: 25 },
  { key: "frames", weight: 15 },
];

/** Hard dismiss, whatever happens. Without this a device that cannot create a
 *  WebGL context would leave the visitor staring at a black screen forever. */
const TIMEOUT_MS = 8000;

export default function Loader() {
  const rootRef = useRef(null);
  const barRef = useRef(null);
  const countRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const state = { shown: 0 };
    let real = 0;
    let finished = false;

    /**
     * Front-loaded curve.
     *
     * A bar that stalls in the middle reads as "this is going to take a
     * while"; the same stall at 95 reads as "nearly there". So the displayed
     * number climbs fast early and decelerates, which puts the unavoidable
     * waiting at the top of the range. The four real milestones land at
     * roughly 73, 87 and 98 instead of 45, 60 and 85.
     */
    const curve = (v) => 100 * (1 - Math.pow(1 - v / 100, 2.2));

    /** Never show 100 until it genuinely is. */
    const CEILING = 99;

    const paint = () => {
      const v = Math.min(100, Math.round(state.shown));
      if (countRef.current) countRef.current.textContent = String(v);
      if (barRef.current) barRef.current.style.transform = `scaleX(${v / 100})`;
    };

    const setTarget = (next) => {
      real = Math.max(real, next);
      if (finished) return;

      const to = Math.min(curve(real), CEILING);
      gsap.killTweensOf(state);
      gsap.to(state, {
        shown: to,
        duration: 0.7,
        ease: "power2.out",
        onUpdate: paint,
        onComplete: () => {
          paint();
          // A number frozen mid-load reads as broken, so keep it drifting
          // toward the ceiling while waiting for the next milestone — slowly
          // enough that it can never arrive before the real progress does.
          const creep = Math.min(to + 7, CEILING);
          if (creep > to) {
            gsap.to(state, {
              shown: creep,
              duration: 6,
              ease: "none",
              onUpdate: paint,
            });
          }
        },
      });
    };

    const dismiss = () => {
      if (finished) return;
      finished = true;

      // Snap the last stretch quickly — the payoff for having held the number
      // in the 90s is that finishing feels sudden rather than laboured.
      gsap.killTweensOf(state);
      gsap.to(state, {
        shown: 100,
        duration: 0.28,
        ease: "power2.in",
        onUpdate: paint,
        onComplete: paint,
      });

      document.body.style.overflow = "";

      // Pins were measured while the scroll lock above was hiding the
      // scrollbar, so their spacers baked in the wider viewport. Releasing
      // the lock brings the scrollbar back and those stale widths then
      // overflow by exactly the scrollbar width — remeasure.
      ScrollTrigger.refresh();
      gsap.to(root, {
        opacity: 0,
        duration: 0.45,
        delay: 0.25,
        ease: "power2.out",
        onComplete: () => {
          root.style.display = "none";
          // Above-the-fold reveals hold until this fires, so they play to a
          // visible page rather than to the back of the overlay.
          markDismissed();
        },
      });
    };

    // Nothing behind the overlay should scroll while it is up.
    document.body.style.overflow = "hidden";
    paint();

    const unsubscribe = onReady((done) => {
      const total = STEPS.reduce(
        (sum, step) => sum + (done.has(step.key) ? step.weight : 0),
        0
      );
      setTarget(total);
      if (total >= 100) dismiss();
    });

    const timer = setTimeout(dismiss, TIMEOUT_MS);

    return () => {
      unsubscribe();
      clearTimeout(timer);
      gsap.killTweensOf(state);
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div ref={rootRef} className="loader">
      <div ref={barRef} className="loaderBar" />
      <span ref={countRef} className="loaderCount">
        0
      </span>
    </div>
  );
}
