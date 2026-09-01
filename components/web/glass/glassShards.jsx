"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "./glass.css";
import { PRESETS } from "./presets";

// WebGL cannot be server-rendered, and in Next 16 `ssr: false` is only
// allowed inside a Client Component — which is why this file carries
// "use client" and the scene is pulled in dynamically rather than imported
// at the top. See node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md
const GlassScene = dynamic(() => import("./scene"), { ssr: false });

/** True below `breakpoint`. Starts false and corrects on mount. */
function useIsNarrow(breakpoint) {
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

/**
 * A glass shard, or a mosaic of them, sized to whatever box you put it in.
 *
 *   <GlassShards preset="prism" />
 *   <GlassShards preset="prism" seed={31} coreColor="#ff7ac2" zoom={0.8} />
 *   <GlassShards preset="prismMosaic" mobile={{ zoom: 0.9, tilt: 0 }} />
 *
 * Presets come from ./presets, exported straight out of the lab at /test.
 * Anything in `mobile` replaces the matching prop below `breakpoint`.
 *
 * The canvas is pointer-events:none, so it never intercepts clicks on the
 * content in front of it. Cursor tilt therefore comes from a window
 * listener rather than from canvas events.
 *
 * @param {{
 *   preset?: "prism" | "prismMosaic",
 *   className?: string,
 *   background?: string | null,
 *   maxDpr?: number,
 *   seed?: number,
 *   coreColor?: string,
 *   hue?: number,
 *   brightness?: number,
 *   zoom?: number,
 *   backdrop?: string | null,
 *   rimColor?: string,
 *   attenuationColor?: string,
 *   edgeColor?: string,
 *   speed?: number,
 *   idle?: number,
 *   tilt?: number,
 *   fit?: "contain" | "cover",
 *   offsetX?: number,
 *   offsetY?: number,
 *   mobile?: object,
 *   breakpoint?: number,
 *   eager?: boolean,
 * }} props
 */
export default function GlassShards({
  preset = "prism",
  className = "",
  /**
   * Clear colour for the canvas. Transparent by default so shards can be
   * layered over each other and over page content — an opaque canvas paints
   * a visible rectangle over whatever sits behind it.
   */
  background = null,
  /** Upper device-pixel-ratio bound. Uncapped DPR is very expensive here. */
  maxDpr = 1.75,
  /** Changes the silhouette. Any number — each one is a different break. */
  seed,
  /** Colour of the shard behind the glass. Single-shard presets. */
  coreColor,
  /** Palette start in degrees, 0–360. Mosaic presets. */
  hue,
  /** Brightness of the shard behind. */
  brightness,
  /** Apparent size within its box. 1 fills it, 0.6 sits smaller, 1.4 crops in. */
  zoom = 1,
  /** Flat colour filled in behind each shard, in that shard's own outline. */
  backdrop = "#171717",
  /** Fresnel rim colour. The brightest part of a shard. */
  rimColor,
  /** Tints light passing through the glass — colours the whole interior. */
  attenuationColor,
  /** Outline stroke colour. */
  edgeColor,
  /** Multiplies how fast the shard behind turns and orbits. 0 freezes it. */
  speed = 1,
  /**
   * Amount of idle float — the slow drift a shard has on its own, with no
   * cursor involved. Phase is derived from the seed, so shards with
   * different seeds never move in step. 0 turns it off.
   */
  idle = 1,
  /** How far it leans toward the cursor. 0 ignores the mouse entirely. */
  tilt,
  /**
   * "contain" keeps the whole shape in frame whatever the box shape.
   * "cover" fills the box and lets it overflow — use this when a wide box
   * should look like a narrow one rather than shrinking the shape to fit.
   */
  fit = "contain",
  /** Pan within the box, in multiples of the shape's own radius. */
  offsetX = 0,
  offsetY = 0,
  /** Overrides applied below `breakpoint`, e.g. { zoom: 0.9, tilt: 0 }. */
  mobile,
  /** Width in px below which `mobile` applies. */
  breakpoint = 768,
  /**
   * Mount immediately instead of waiting to be scrolled near.
   *
   * Creating the context and compiling the transmission shader blocks the
   * main thread, so a lazy mount lands that cost wherever the visitor
   * happens to be scrolling — which can stall an animation running at that
   * moment. Mounting up front moves it to page load, while nothing is
   * moving. It does not delay the loader, which gates on the hero alone.
   */
  eager = false,
}) {
  const narrow = useIsNarrow(breakpoint);

  // One resolved set of values: the props, then mobile overrides on top.
  const p = useMemo(() => {
    const base = {
      preset,
      background,
      maxDpr,
      seed,
      coreColor,
      hue,
      brightness,
      zoom,
      backdrop,
      rimColor,
      attenuationColor,
      edgeColor,
      speed,
      idle,
      tilt,
      fit,
      offsetX,
      offsetY,
    };
    return narrow && mobile ? { ...base, ...mobile } : base;
  }, [
    narrow,
    mobile,
    preset,
    background,
    maxDpr,
    seed,
    coreColor,
    hue,
    brightness,
    zoom,
    backdrop,
    rimColor,
    attenuationColor,
    edgeColor,
    speed,
    idle,
    tilt,
    fit,
    offsetX,
    offsetY,
  ]);

  // A mistyped preset silently falls back, which looks like the component
  // being broken rather than a typo. Say so in development.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && !PRESETS[p.preset]) {
      console.warn(
        `[GlassShards] unknown preset "${p.preset}" — falling back to "prism". ` +
          `Available: ${Object.keys(PRESETS).join(", ")}.`
      );
    }
  }, [p.preset]);

  // The scene rebuilds its geometry whenever `shape` or `mosaic` change
  // identity, so this must not be rebuilt on every render.
  const config = useMemo(() => {
    const base = PRESETS[p.preset] ?? PRESETS.prism;
    return {
      ...base,
      tilt: p.tilt === undefined ? base.tilt : p.tilt,
      glass: {
        ...base.glass,
        ...(p.rimColor === undefined ? null : { rimColor: p.rimColor }),
        ...(p.attenuationColor === undefined
          ? null
          : { attenuationColor: p.attenuationColor }),
        ...(p.edgeColor === undefined ? null : { edgeColor: p.edgeColor }),
      },
      shape: p.seed === undefined ? base.shape : { ...base.shape, seed: p.seed },
      mosaic:
        p.seed === undefined ? base.mosaic : { ...base.mosaic, seed: p.seed },
      core: {
        ...base.core,
        ...(p.coreColor === undefined ? null : { color: p.coreColor }),
        ...(p.brightness === undefined ? null : { brightness: p.brightness }),
        spin: base.core.spin * p.speed,
        driftSpeed: base.core.driftSpeed * p.speed,
      },
      piece: p.hue === undefined ? base.piece : { ...base.piece, hue: p.hue },
    };
  }, [p]);

  const hostRef = useRef(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  // Sticky: once it has been near the viewport it stays mounted for good.
  const [mounted, setMounted] = useState(eager);
  const [reduced, setReduced] = useState(false);

  // Respect the OS "reduce motion" setting, and follow it if it changes.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Pause the render loop when scrolled out of view — but never unmount.
  //
  // Unmounting destroys the WebGL context, and coming back then costs a new
  // context, a shader recompile, fresh geometry and a rebuilt environment
  // map. That is the visible gap when scrolling back up. Holding the canvas
  // and idling the loop costs almost nothing and resumes on the next frame.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    // Eager instances are already mounted; the observer is still needed so
    // the render loop pauses when they scroll out of view.
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setMounted(true);
      },
      // A full viewport of lead time. Creating the context, compiling the
      // shaders and baking the environment map takes a few hundred ms, and
      // 250px of warning was not enough to finish before it came into view —
      // which is what made it appear to load on arrival.
      { rootMargin: "100% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Cursor tilt, normalised to -1..1 across the viewport. Skipped entirely
  // when the shard does not lean, so a tilt of 0 costs no listener at all.
  const leans = config.sway && config.tilt > 0;
  useEffect(() => {
    if (!leans || reduced) return;
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [leans, reduced]);

  return (
    <div ref={hostRef} className={`glassShards ${className}`.trim()} aria-hidden="true">
      {mounted && (
        <GlassScene
          config={config}
          background={p.background}
          dpr={[1, p.maxDpr]}
          animate={!reduced}
          frameloop={visible && !reduced ? "always" : "demand"}
          pointer={pointer}
          zoom={p.zoom}
          fit={p.fit}
          backdrop={p.backdrop}
          idle={p.idle}
          offsetX={p.offsetX}
          offsetY={p.offsetY}
        />
      )}
    </div>
  );
}
