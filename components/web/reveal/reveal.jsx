"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { onDismissed } from "@/components/web/loader/ready";

// useLayoutEffect warns during SSR, but the initial hide has to happen before
// paint or the text flashes in at full opacity and then jumps back to hidden.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Fades its direct children up as they scroll into view, staggered.
 *
 * Use it *as* the container rather than wrapping one — pass the class the
 * original div had — so it does not add a layout box:
 *
 *   <Reveal className="ctaTextContainer"> … </Reveal>
 *
 * Each direct child is one step of the stagger, so the granularity is
 * whatever the markup already has: heading, paragraph, button.
 *
 * Visibility is decided by IntersectionObserver rather than ScrollTrigger.
 * This page pins the About section, which pushes everything below it down by
 * more than a viewport, and the loader locks scrolling while it is up — so
 * scroll positions measured at mount are wrong until a refresh happens.
 * IntersectionObserver measures nothing up front and simply reports what is
 * actually on screen, which is exactly the question being asked here.
 */
export default function Reveal({
  children,
  className = "",
  /** Seconds between each child. 0 fades them all together. */
  stagger = 0.12,
  /** How far each child travels up, in px. */
  y = 24,
  duration = 0.7,
  /** Seconds to wait after coming into view. Use it to order two Reveals. */
  delay = 0,
  /** How much of the element must be visible before it plays, 0..1. */
  threshold = 0.15,
  /**
   * Hold until the loading overlay has lifted.
   *
   * Anything above the fold intersects the moment it mounts, which is while
   * the overlay still covers the page — so without this the fade plays out
   * behind it and the visitor never sees it.
   */
  waitForLoader = false,
  ...rest
}) {
  const ref = useRef(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = Array.from(el.children);
    if (targets.length === 0) return;

    // Leave the text in place and visible; an entrance animation is not
    // worth hiding content over.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.set(targets, { opacity: 0, y });

    let tween;
    let unwait = () => {};
    let fallback;

    const play = () => {
      tween = gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration,
        delay,
        stagger,
        ease: "power2.out",
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        if (!waitForLoader) {
          play();
          return;
        }

        // If there is no loader on this page the signal never comes, so do
        // not leave the content invisible waiting for it.
        fallback = setTimeout(play, 10000);
        unwait = onDismissed(() => {
          clearTimeout(fallback);
          play();
        });
      },
      // A little margin so it starts as the element comes in rather than
      // once it is already sitting in the middle of the screen.
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      unwait();
      clearTimeout(fallback);
      tween?.kill();
      gsap.set(targets, { clearProps: "opacity,transform" });
    };
  }, [stagger, y, duration, delay, threshold, waitForLoader]);

  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
}
