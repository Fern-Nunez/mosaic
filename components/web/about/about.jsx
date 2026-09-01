"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./about.css";

const Assembly = dynamic(() => import("./assembly"), { ssr: false });

/** Progress at which the copy swaps over, 0..1. */
const SWAP_AT = 0.62;
/** Seconds the copy takes to cross-fade, independent of scroll speed. */
const SWAP_DURATION = 0.4;

export default function About() {
  const progress = useRef(0);
  const stageRef = useRef(null);
  const firstRef = useRef(null);
  const secondRef = useRef(null);
  const swapped = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      progress.current = 1;
      gsap.set(firstRef.current, { opacity: 0 });
      gsap.set(secondRef.current, { opacity: 1 });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // On mobile the URL bar showing and hiding changes the viewport height,
    // which makes ScrollTrigger recalculate every pin position mid-scroll.
    // That recalculation is the jump: you scroll up past the lock, the bar
    // reappears, positions shift, and you get snapped back to the new start.
    ScrollTrigger.config({ ignoreMobileResize: true });

    swapped.current = false;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: stageRef.current,
        start: "top top",
        end: "+=130%",
        pin: true,
        // Applies the pin a frame early. Touch scrolling is handled off the
        // main thread, so on a fast flick the scroll can outrun the pin and
        // land past it before the transform is applied — which then looks
        // like being yanked backwards.
        anticipatePin: 1,
        scrub: 0.6,
        onUpdate: (self) => {
          progress.current = self.progress;

          // The copy is deliberately not scrubbed. It flips once, when
          // progress crosses the threshold, then plays out over its own
          // fixed duration — so the words read at a steady speed however
          // fast or slow the page is being scrolled. The ref guard stops it
          // retriggering while hovering around the threshold, and it
          // reverses cleanly on the way back up.
          const past = self.progress >= SWAP_AT;
          if (past !== swapped.current) {
            swapped.current = past;
            gsap.to(firstRef.current, {
              opacity: past ? 0 : 1,
              duration: SWAP_DURATION,
            });
            gsap.to(secondRef.current, {
              opacity: past ? 1 : 0,
              duration: SWAP_DURATION,
            });
          }
        },
      });
    }, stageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={stageRef} className="aboutContainer" id="about">
      <div className="aboutGlass">
        <Assembly progress={progress} />
      </div>

      <div className="aboutCopy">
        <div ref={firstRef} className="aboutTextContainer">
          <h2>Does this sound familiar?</h2>
          <div className="aboutDescriptionText">
            <p>A budgeting app here, a calorie counter there, a habit tracker you keep forgetting to open, and a journal buried somewhere...</p>
          </div>
        </div>

        <div ref={secondRef} className="aboutTextContainer aboutTextContainerSecond">
          <h2>Finally, One Place where Everything is Connected</h2>
          <div className="aboutDescriptionText">
            <p>When your money, food, training, and mood live side by side, the patterns finally show up — the ones no single app can see.</p>
          </div>
        </div>
      </div>
    </div>
  );
}