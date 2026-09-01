"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import gsap from "gsap";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Reveals a sentence word by word, the way it would be read.
 *
 * The words are laid out in DOM order, which is reading order — so a plain
 * stagger travels left to right and wraps onto each new line by itself. No
 * line measurement needed.
 *
 * Only opacity is animated, and the spans stay `inline`. An inline-block or a
 * transform would change how the text wraps, which on a centred, justified
 * paragraph is very visible.
 *
 *   <ReadingReveal>Every entry is one more dot on the canvas…</ReadingReveal>
 */
export default function ReadingReveal({
  children,
  className = "",
  /** Seconds between words. ~0.03 reads at a natural pace. */
  stagger = 0.03,
  /** Seconds each word takes to arrive. */
  duration = 0.5,
  threshold = 0.2,
  ...rest
}) {
  const ref = useRef(null);

  const words = useMemo(
    () => String(children).split(/(\s+)/).filter((part) => part.length > 0),
    [children]
  );

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = el.querySelectorAll("[data-word]");
    if (targets.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.set(targets, { opacity: 0 });

    let tween;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        tween = gsap.to(targets, {
          opacity: 1,
          duration,
          stagger,
          ease: "none",
        });
      },
      { threshold, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      tween?.kill();
      gsap.set(targets, { clearProps: "opacity" });
    };
  }, [stagger, duration, threshold, words]);

  return (
    <p ref={ref} className={className} {...rest}>
      {words.map((part, i) =>
        // Whitespace runs are kept as their own nodes and left alone, so
        // wrapping behaves exactly as it did before the split.
        /^\s+$/.test(part) ? (
          part
        ) : (
          <span key={i} data-word>
            {part}
          </span>
        )
      )}
    </p>
  );
}
