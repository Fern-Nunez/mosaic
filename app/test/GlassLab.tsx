"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Edges,
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
} from "@react-three/drei";
import {
  buildShape,
  SHAPE_DEFAULTS,
  SHAPE_PRESETS,
  type ShapeParams,
} from "@/lib/glass/shape2d";
import {
  SAVED_LOOKS,
  loadStoredLook,
  parseLook,
  storeLook,
  type LookState,
} from "./looks";
import {
  buildMosaic,
  mosaicInradius,
  MOSAIC_DEFAULTS,
  type MosaicParams,
} from "@/lib/glass/mosaic";
import {
  frostValues,
  hiddenFit,
  RIM_FRAG,
  RIM_VERT,
  SHEEN_FRAG,
  SHEEN_VERT,
} from "@/lib/glass/shaders";

type Mode = "single" | "mosaic";

/* ------------------------------------------------------------------ */
/* Material parameters                                                 */
/* ------------------------------------------------------------------ */

type Glass = {
  /** How see-through the glass is. Lower it to let piece colour dominate. */
  transmission: number;
  /** Faked refraction depth — nothing to do with the geometry's depth. */
  thickness: number;
  /**
   * Figma's Frost, as one control. Drives surface roughness and the blur of
   * the refracted background together, and raises the sample count with them
   * — heavy blur on few samples is what produced the dither grain earlier.
   */
  frost: number;
  ior: number;
  chromaticAberration: number;
  distortion: number;
  envIntensity: number;
  attenuationDistance: number;
  edges: boolean;
  edgeWidth: number;
  rim: boolean;
  rimIntensity: number;
  rimPower: number;
  color: string;
  attenuationColor: string;
  edgeColor: string;
  rimColor: string;
  bg: string;
};

const GLASS_DEFAULTS: Glass = {
  // Fern's "Prism" look, 2026-08-30. Note envIntensity 0: there are no
  // environment reflections at all here, so the surface is carried entirely
  // by the fresnel rim and by refraction of the inner shard behind it.
  transmission: 1,
  thickness: 2.79,
  frost: 0.5,
  ior: 1.41,
  chromaticAberration: 0.27,
  distortion: 1.5,
  envIntensity: 0,
  attenuationDistance: 3.34,
  edges: true,
  edgeWidth: 0.8,
  rim: true,
  rimIntensity: 1.5,
  rimPower: 3.2,
  color: "#ffffff",
  attenuationColor: "#a8c6ff",
  edgeColor: "#e2ecff",
  rimColor: "#9dc0ff",
  bg: "#171717",
};

/**
 * Frost → the three values it actually controls.
 *
 * Sample count rises with the blur on purpose. The blur is estimated by
 * taking N taps of the refraction buffer; if N stays low while the radius
 * grows, the shortfall shows up as dither grain rather than as blur.
 */
/* ------------------------------------------------------------------ */
/* Inner shard — a bright copy of the shape, hidden behind it          */
/* ------------------------------------------------------------------ */

export type Core = {
  enabled: boolean;
  /** Fraction of the outer shape. Must stay under 1 to remain hidden. */
  scale: number;
  /** How far behind — more depth reads as more parallax through the glass. */
  offset: number;
  /** Colour multiplier. The core is unlit, so this is its actual brightness. */
  brightness: number;
  /** Slow rotation in the shape's own plane. */
  spin: number;
  /** How far it orbits behind the glass, in world units. Rotation alone is
   *  invisible on a near-symmetric outline; travel is what reads as motion. */
  drift: number;
  /** Orbit speed. */
  driftSpeed: number;
  /** Single-shape mode only; the mosaic uses each piece's own hue. */
  color: string;
};

export const CORE_DEFAULTS: Core = {
  enabled: true,
  scale: 0.45,
  offset: 0.35,
  brightness: 1.9,
  spin: 0.35,
  drift: 0.12,
  driftSpeed: 0.5,
  color: "#66d9ff",
};

/**
 * How big the hidden copy may be, and how far it may travel.
 *
 * A point of the copy sits at most scale*circumradius from the centre, and
 * drift moves it a further `drift`. The sum has to stay inside the inscribed
 * circle, so the two compete for one budget — and drift has to be clamped as
 * well as scale. Clamping scale alone hits its floor on small pieces and the
 * copy walks straight out from behind them.
 *
 * The 0.9 leaves headroom for the bevel, which grows the outer shape and the
 * inner copy by different absolute amounts.
 */


/**
 * A scaled-down copy of the very same geometry, sitting behind the shape and
 * lit by nothing (meshBasicMaterial), so it acts purely as a light source for
 * the glass in front of it. Because it is the same outline, the refracted
 * core echoes the silhouette instead of being a generic blob.
 *
 * `maxScale` is the caller's guarantee that it stays hidden: for a convex
 * piece any scale < 1 about the centroid is safe, but once it spins the copy
 * sweeps a disc, so the bound becomes inradius / circumradius.
 */
function InnerShard({
  geometry,
  color,
  core,
  inradius,
  circumradius,
}: {
  geometry: THREE.BufferGeometry;
  color: THREE.Color | string;
  core: Core;
  inradius: number;
  circumradius: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  const tint = useMemo(
    () => new THREE.Color(color).multiplyScalar(core.brightness),
    [color, core.brightness]
  );

  const fit = hiddenFit(inradius, circumradius, core.scale, core.drift);

  useFrame((state, dt) => {
    const m = ref.current;
    if (!m) return;
    if (core.spin !== 0) m.rotation.z += dt * core.spin;
    if (fit.drift > 0) {
      // Ellipse rather than a circle, so the travel does not look mechanical.
      const t = state.clock.elapsedTime * core.driftSpeed;
      m.position.x = Math.sin(t) * fit.drift;
      m.position.y = Math.cos(t * 0.77) * fit.drift * 0.7;
    }
  });

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      scale={fit.scale}
      position={[0, 0, -core.offset]}
      renderOrder={-1}
    >
      <meshBasicMaterial color={tint} toneMapped={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

export type BgMode = "shard" | "blob" | "material" | "flat" | "gradient" | "grid";

export const BG_MODES: { key: BgMode; label: string; note: string }[] = [
  {
    key: "shard",
    label: "Inner shard",
    note: "A smaller, brighter copy of the same shape sitting behind it. Being the same outline, the refracted core echoes the silhouette instead of smearing like a blob. Scale is clamped so it stays hidden even while it spins.",
  },
  {
    key: "blob",
    label: "Hidden blob",
    note: "An opaque glow plane parented behind the shape, smaller than its silhouette. Its texture fades to the page colour well before the plane's own edge, so even if a corner pokes out it is literally the same pixel value as the background — nothing to see. The glass refracts it.",
  },
  {
    key: "material",
    label: "Glass-only bg",
    note: "No geometry at all. The glow is handed to the material as its `background`, which drei swaps in for the refraction pass and restores immediately after. The page stays flat — this one cannot leak, at any angle.",
  },
  {
    key: "flat",
    label: "Flat",
    note: "Nothing behind the glass. Refraction, distortion and chromatic aberration all go to zero — bending a uniform colour returns that same colour. Only reflections, the bevel highlight and the rim survive.",
  },
  {
    key: "gradient",
    label: "Soft gradient",
    note: "A faint full-frame wash. Visible as a background, but gives refraction a slope to bend across the whole scene.",
  },
  {
    key: "grid",
    label: "Grid + text",
    note: "High-contrast reference. Straight lines make the exact amount of distortion and chromatic aberration obvious.",
  },
];

export type Blob = {
  /** Plane size relative to the shape. Keep under ~0.8 to stay tucked behind. */
  size: number;
  /** How far the glow reaches before it dissolves into the page colour. */
  softness: number;
  /** Glow brightness. */
  intensity: number;
  /** Distance behind the shape — more depth reads as more parallax. */
  offset: number;
  /** Slow orbit, so the refraction shifts instead of sitting still. */
  drift: number;
  colorA: string;
  colorB: string;
};

export const BLOB_DEFAULTS: Blob = {
  // 0.45 keeps the glow inside even the Triangle preset, whose inscribed
  // radius (0.49) is the tightest of the presets. Raise it for rounder
  // outlines, which have far more room.
  size: 0.45,
  softness: 0.72,
  intensity: 1,
  offset: 0.5,
  drift: 0.35,
  colorA: "#5b8cff",
  colorB: "#ff7ac2",
};

/**
 * Two coloured pools fading to `base`. Drawn opaque: the fade reaches the
 * page colour before the texture's edge, so the plane has no visible border
 * even where it is not covered by the shape.
 */
function makeBlobTexture(blob: Blob, base: string, forBackground: boolean) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  // A full-frame background needs the glow spread wider than a tucked plane.
  const reach = (forBackground ? 300 : 210) * blob.softness;
  const pools: [number, number, string][] = [
    [216, 232, blob.colorA],
    [304, 296, blob.colorB],
  ];

  ctx.globalCompositeOperation = "lighter";
  for (const [x, y, color] of pools) {
    const col = new THREE.Color(color).multiplyScalar(blob.intensity);
    const g = ctx.createRadialGradient(x, y, 0, x, y, reach);
    g.addColorStop(0, `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.95)`);
    g.addColorStop(0.55, `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.28)`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  }
  ctx.globalCompositeOperation = "source-over";

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The glow plane itself. Parented to the shape, so when the shape tilts the
 * blob tilts with it and coverage never changes — the one way it could
 * otherwise slide out from behind.
 */
function HiddenBlob({ blob, base }: { blob: Blob; base: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => makeBlobTexture(blob, base, false), [blob, base]);

  useFrame((state) => {
    if (!ref.current || blob.drift <= 0) return;
    const t = state.clock.elapsedTime * blob.drift;
    ref.current.position.x = Math.sin(t) * 0.22;
    ref.current.position.y = Math.cos(t * 0.8) * 0.16;
  });

  return (
    <mesh ref={ref} position={[0, 0, -blob.offset]} renderOrder={-1}>
      <planeGeometry args={[3.4 * blob.size, 3.4 * blob.size]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/**
 * What sits behind the glass. On "flat" this renders nothing, which is the
 * honest demonstration: transmission has nothing to sample, so the shape
 * falls back to reflections alone.
 */
function Backdrop({ mode, base }: { mode: BgMode; base: string }) {
  const texture = useMemo(() => {
    // "blob" and "material" put their glow elsewhere; the full-frame
    // backdrop stays empty for both.
    if (mode !== "gradient" && mode !== "grid") return null;

    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);

    if (mode === "gradient") {
      const g = ctx.createLinearGradient(0, 512, 512, 0);
      g.addColorStop(0, "rgba(120,150,255,0.16)");
      g.addColorStop(0.5, "rgba(255,255,255,0.03)");
      g.addColorStop(1, "rgba(255,140,90,0.14)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
    }

    if (mode === "grid") {
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      for (let i = 0; i <= 512; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
      ctx.fillStyle = "#e8ecf5";
      ctx.font = "bold 76px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("MOSAIC", 256, 285);
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [mode, base]);

  if (!texture) return null;

  return (
    <mesh position={[0, 0, -2.5]}>
      <planeGeometry args={[16, 10]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Colour field — the thing the mosaic refracts                        */
/* ------------------------------------------------------------------ */

/**
 * Per-piece colour.
 *
 * With a flat background there is nothing behind the glass to tint, so
 * `color` and `attenuationColor` alone would just multiply a dark value and
 * stay dark. The colour has to be self-lit: `emissive` carries the interior
 * glow, the attenuation tint colours what little light does pass through,
 * and the rim picks up the same hue so each piece's outline matches it.
 */
export type Piece = {
  /** Where the palette starts on the colour wheel, degrees. */
  hue: number;
  /** How much of the wheel the palette walks across, degrees. */
  spread: number;
  saturation: number;
  lightness: number;
  /** Interior glow — the slider that actually makes the colour visible. */
  glow: number;
  /** Per-piece random hue wobble, so it is not a clean gradient. */
  jitter: number;
  /** Reshuffles which piece gets which hue. */
  seed: number;
  /** Tint each piece's rim with its own colour instead of the global one. */
  tintRim: boolean;
  /**
   * Whether the hue touches the glass itself. Off means every piece renders
   * with identical glass and the colour lives only in the shard behind it,
   * which is what makes them all read as the same material.
   */
  tintGlass: boolean;
};

export const PIECE_DEFAULTS: Piece = {
  hue: 265,
  spread: 320,
  saturation: 0.7,
  lightness: 0.55,
  glow: 0.06,
  jitter: 0.12,
  seed: 5,
  tintRim: false,
  tintGlass: false,
};

/** Hue-walk across the palette, shuffled so neighbours never match. */
function pieceColours(count: number, p: Piece): THREE.Color[] {
  let s = (p.seed * 7919 + 11) % 2147483647;
  if (s <= 0) s += 2147483646;
  const rand = () => ((s = (s * 16807) % 2147483647), (s - 1) / 2147483646);

  const order = [...Array(count).keys()];
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return order.map((k) => {
    const t = count > 1 ? k / count : 0;
    const hue = (p.hue + t * p.spread + (rand() - 0.5) * p.jitter * 360 + 360) % 360;
    return new THREE.Color().setHSL(hue / 360, p.saturation, p.lightness);
  });
}

export type Field = {
  /** Off by default — the page reads as flat, colour comes from the pieces. */
  enabled: boolean;
  /** How many colour pools. */
  count: number;
  /** Pool radius. */
  softness: number;
  intensity: number;
  /** Where the palette starts on the colour wheel, degrees. */
  hue: number;
  /** How much of the wheel the palette covers, degrees. */
  spread: number;
  saturation: number;
  /** Slow orbit so the colours move through the pieces. */
  drift: number;
  seed: number;
};

export const FIELD_DEFAULTS: Field = {
  enabled: false,
  count: 6,
  softness: 0.8,
  intensity: 1.5,
  hue: 285,
  spread: 300,
  saturation: 0.85,
  drift: 0.22,
  seed: 3,
};

/**
 * Pools of colour over the page colour. Opaque, and faded to `base` well
 * inside its own edge — so wherever a seam or a gap in the mosaic exposes
 * it, what shows through is the background colour, not a visible plane.
 */
function makeFieldTexture(field: Field, base: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 768;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 768, 768);

  let s = field.seed * 9301 + 49297;
  const rand = () => ((s = (s * 16807) % 2147483647), (s - 1) / 2147483646);

  const n = Math.max(1, Math.round(field.count));
  const reach = 300 * field.softness;

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    // Spread the pools around a ring so no quadrant is left grey.
    const a = (i / n) * Math.PI * 2 + rand() * 0.6;
    const rad = 150 + rand() * 170;
    const x = 384 + Math.cos(a) * rad;
    const y = 384 + Math.sin(a) * rad;

    const hue = (field.hue + (i / n) * field.spread) % 360;
    const col = new THREE.Color().setHSL(hue / 360, field.saturation, 0.55);
    col.multiplyScalar(field.intensity);
    const rgb = `${Math.min(255, (col.r * 255) | 0)},${Math.min(255, (col.g * 255) | 0)},${Math.min(255, (col.b * 255) | 0)}`;

    const g = ctx.createRadialGradient(x, y, 0, x, y, reach);
    g.addColorStop(0, `rgba(${rgb},0.95)`);
    g.addColorStop(0.5, `rgba(${rgb},0.35)`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 768, 768);
  }
  ctx.globalCompositeOperation = "source-over";

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ColourField({
  field,
  base,
  size,
  offset,
}: {
  field: Field;
  base: string;
  size: number;
  offset: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => makeFieldTexture(field, base), [field, base]);

  useFrame((state) => {
    if (!ref.current || field.drift <= 0) return;
    const t = state.clock.elapsedTime * field.drift;
    ref.current.position.x = Math.sin(t) * 0.3;
    ref.current.position.y = Math.cos(t * 0.75) * 0.22;
    ref.current.rotation.z = Math.sin(t * 0.3) * 0.15;
  });

  return (
    <mesh ref={ref} position={[0, 0, -offset]} renderOrder={-1}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Per-piece sheen — light across a piece, not a flat fill             */
/* ------------------------------------------------------------------ */

export type Sheen = {
  /** Strength of the bright band. */
  intensity: number;
  /** How abruptly bright turns to dark. Low = a hard glint, high = a wash. */
  softness: number;
  /** Where the bright/dark split sits across the piece. */
  bias: number;
  /** Randomises the split per piece, so the tiles do not all match. */
  variation: number;
  /** Mixes the piece hue toward white in the glass tint itself. */
  tint: number;
  seed: number;
};

export const SHEEN_DEFAULTS: Sheen = {
  intensity: 0,
  softness: 0.55,
  bias: 0,
  variation: 0.5,
  tint: 0.35,
  seed: 2,
};

/** Per-piece offset for the bright/dark split. Seeded, so it is stable. */
function sheenBiases(count: number, sheen: Sheen): number[] {
  let s = (sheen.seed * 4241 + 17) % 2147483647;
  if (s <= 0) s += 2147483646;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    s = (s * 16807) % 2147483647;
    const r = (s - 1) / 2147483646;
    out.push(sheen.bias + (r - 0.5) * sheen.variation);
  }
  return out;
}



function PieceSheen({
  geometry,
  color,
  radius,
  dir,
  sheen,
  bias,
}: {
  geometry: THREE.BufferGeometry;
  color: THREE.Color;
  radius: number;
  dir: THREE.Vector2;
  sheen: Sheen;
  bias: number;
}) {
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <shaderMaterial
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        blending={THREE.AdditiveBlending}
        vertexShader={SHEEN_VERT}
        fragmentShader={SHEEN_FRAG}
        uniforms={{
          uColor: { value: color },
          uDir: { value: dir },
          uRadius: { value: radius },
          uSoft: { value: Math.max(0.01, sheen.softness) },
          uIntensity: { value: sheen.intensity },
          uBias: { value: bias },
        }}
      />
    </mesh>
  );
}

/**
 * Fresnel rim. Additive shell on the same geometry: transparent head-on,
 * bright at grazing angles, so it traces the silhouette. This is what
 * keeps the shape visible when there is no backdrop to refract.
 */
function RimGlow({
  geometry,
  color,
  intensity,
  power,
  lightDir,
  directional,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  intensity: number;
  power: number;
  lightDir: THREE.Vector3;
  directional: number;
}) {
  return (
    <mesh geometry={geometry} renderOrder={2}>
      <shaderMaterial
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
        blending={THREE.AdditiveBlending}
        vertexShader={RIM_VERT}
        fragmentShader={RIM_FRAG}
        uniforms={{
          uColor: { value: new THREE.Color(color) },
          uIntensity: { value: intensity },
          uPower: { value: power },
          uLightDir: { value: lightDir },
          uDirectional: { value: directional },
        }}
      />
    </mesh>
  );
}

/**
 * The shape itself. Stays flat-on to the camera; `sway` only tilts it a
 * few degrees so the highlight travels across the bevel — a dead-still
 * flat pane is the one thing that never reads as glass.
 */
function GlassShape({
  params,
  glass,
  blob,
  bgMode,
  reveal,
  light,
  core,
  sway,
  tilt,
}: {
  params: ShapeParams;
  glass: Glass;
  blob: Blob;
  bgMode: BgMode;
  reveal: boolean;
  light: Light;
  core: Core;
  sway: boolean;
  tilt: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => buildShape(params), [params]);
  const { pointer } = useThree();
  const fr = frostValues(glass.frost);

  // Only the glass ever sees this one — drei swaps it into scene.background
  // for the refraction pass and puts the old one back on the same frame.
  const glassOnlyBg = useMemo(
    () => (bgMode === "material" ? makeBlobTexture(blob, glass.bg, true) : undefined),
    [bgMode, blob, glass.bg]
  );

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // Follow the cursor a little, plus a slow idle drift.
    const targetY = sway ? pointer.x * tilt + Math.sin(t * 0.4) * tilt * 0.35 : 0;
    const targetX = sway ? -pointer.y * tilt + Math.cos(t * 0.3) * tilt * 0.25 : 0;
    ref.current.rotation.y += (targetY - ref.current.rotation.y) * 0.06;
    ref.current.rotation.x += (targetX - ref.current.rotation.x) * 0.06;
  });

  return (
    <mesh ref={ref} geometry={geometry}>
      {bgMode === "blob" && <HiddenBlob blob={blob} base={glass.bg} />}
      {bgMode === "shard" && core.enabled && (
        <InnerShard
          geometry={geometry}
          color={core.color}
          core={core}
          inradius={(geometry.userData.inradius as number) ?? 0}
          circumradius={(geometry.userData.circumradius as number) ?? 1}
        />
      )}

      {reveal ? (
        // Debug view: show where the blob actually sits, with the glass
        // reduced to an outline so you can check it stays covered.
        <meshBasicMaterial wireframe color="#4a5570" />
      ) : (
      <MeshTransmissionMaterial
        background={glassOnlyBg}
        samples={fr.samples}
        resolution={1024}
        transmission={glass.transmission}
        thickness={glass.thickness}
        roughness={fr.roughness}
        ior={glass.ior}
        chromaticAberration={glass.chromaticAberration}
        anisotropicBlur={fr.blur}
        distortion={glass.distortion}
        distortionScale={0.3}
        temporalDistortion={0.05}
        backside={false}
        envMapIntensity={glass.envIntensity}
        clearcoat={0.6}
        clearcoatRoughness={0.04}
        color={glass.color}
        attenuationColor={glass.attenuationColor}
        attenuationDistance={glass.attenuationDistance}
      />
      )}
      {glass.edges && (
        <Edges
          polygonOffset
          polygonOffsetFactor={-6}
          polygonOffsetUnits={-6}
          threshold={15}
          color={glass.edgeColor}
          lineWidth={glass.edgeWidth}
        />
      )}
      {glass.rim && (
        <RimGlow
          geometry={geometry}
          color={glass.rimColor}
          intensity={glass.rimIntensity}
          power={glass.rimPower}
          lightDir={lightVector(light)}
          directional={light.directional}
        />
      )}
    </mesh>
  );
}

/**
 * The mosaic. Every piece shares one refraction buffer via
 * `transmissionSampler` — three renders the opaque scene (which includes
 * the colour field) into its own transmission target once per frame, and
 * all the pieces sample that. Without it each piece would trigger its own
 * full scene render, so 22 pieces would mean 22 render passes.
 */
function MosaicScene({
  params,
  glass,
  field,
  piece,
  light,
  sheen,
  core,
  sway,
  tilt,
}: {
  params: MosaicParams;
  glass: Glass;
  field: Field;
  piece: Piece;
  light: Light;
  sheen: Sheen;
  core: Core;
  sway: boolean;
  tilt: number;
}) {
  const group = useRef<THREE.Group>(null);
  const pieces = useMemo(() => buildMosaic(params), [params]);
  const { pointer } = useThree();
  const fr = frostValues(glass.frost);

  const colours = useMemo(
    () => pieceColours(pieces.length, piece),
    [pieces.length, piece]
  );

  // The glass tint itself is pulled toward white by `tint`. A full-strength
  // hue multiplies an already-dark refracted background and the piece goes
  // muddy; the saturated colour belongs in the additive sheen instead.
  const tints = useMemo(
    () =>
      colours.map((c) =>
        new THREE.Color("#ffffff").lerp(c, THREE.MathUtils.clamp(sheen.tint, 0, 1))
      ),
    [colours, sheen.tint]
  );

  // Per-piece offset for where the bright band sits, so the tiles do not all
  // light up in the same place.
  const biases = useMemo(
    () => sheenBiases(pieces.length, sheen),
    [pieces.length, sheen]
  );

  // Sheen falls back to the glass tint, so an untinted mosaic gets one
  // consistent highlight colour across every piece.
  const sheenNeutral = useMemo(
    () => new THREE.Color(glass.color),
    [glass.color]
  );

  const sheenDir = useMemo(() => {
    const a = (light.angle * Math.PI) / 180;
    return new THREE.Vector2(Math.cos(a), Math.sin(a));
  }, [light.angle]);

  // Keep the colour field inside the outline so its edge never shows.
  const fieldSize = useMemo(() => mosaicInradius(params) * 1.9, [params]);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const ty = sway ? pointer.x * tilt + Math.sin(t * 0.35) * tilt * 0.3 : 0;
    const tx = sway ? -pointer.y * tilt + Math.cos(t * 0.28) * tilt * 0.22 : 0;
    group.current.rotation.y += (ty - group.current.rotation.y) * 0.06;
    group.current.rotation.x += (tx - group.current.rotation.x) * 0.06;
  });

  return (
    <group ref={group}>
      {field.enabled && (
        <ColourField field={field} base={glass.bg} size={fieldSize} offset={0.6} />
      )}

      {pieces.map((p, i) => (
        <mesh
          key={p.key}
          geometry={p.geometry}
          position={p.position}
          rotation={p.rotation}
        >
          <MeshTransmissionMaterial
            transmissionSampler
            samples={fr.samples}
            resolution={1024}
            transmission={glass.transmission}
            thickness={glass.thickness}
            roughness={fr.roughness}
            ior={glass.ior}
            chromaticAberration={glass.chromaticAberration}
            anisotropicBlur={fr.blur}
            distortion={glass.distortion}
            distortionScale={0.3}
            temporalDistortion={0}
            backside={false}
            envMapIntensity={glass.envIntensity}
            clearcoat={0.5}
            clearcoatRoughness={0.05}
            color={piece.tintGlass ? tints[i] : glass.color}
            emissive={colours[i]}
            emissiveIntensity={piece.tintGlass ? piece.glow : 0}
            attenuationColor={
              piece.tintGlass ? tints[i] : glass.attenuationColor
            }
            attenuationDistance={glass.attenuationDistance}
          />
          {glass.edges && (
            <Edges
              polygonOffset
              polygonOffsetFactor={-6}
              polygonOffsetUnits={-6}
              threshold={15}
              color={glass.edgeColor}
              lineWidth={glass.edgeWidth}
            />
          )}
          {core.enabled && (
            <InnerShard
              geometry={p.geometry}
              color={colours[i]}
              core={core}
              inradius={p.inradius}
              circumradius={p.radius}
            />
          )}
          {sheen.intensity > 0 && (
            <PieceSheen
              geometry={p.geometry}
              color={piece.tintGlass ? colours[i] : sheenNeutral}
              radius={p.radius}
              dir={sheenDir}
              sheen={sheen}
              bias={biases[i]}
            />
          )}
          {glass.rim && (
            <RimGlow
              geometry={p.geometry}
              color={
                piece.tintRim ? `#${colours[i].getHexString()}` : glass.rimColor
              }
              intensity={glass.rimIntensity}
              power={glass.rimPower}
              lightDir={lightVector(light)}
              directional={light.directional}
            />
          )}
        </mesh>
      ))}
    </group>
  );
}

export type Light = {
  /** Key light direction around the shape, degrees. Figma's "Light". */
  angle: number;
  intensity: number;
  /** How much the rim follows the light vs. tracing the whole silhouette. */
  directional: number;
};

export const LIGHT_DEFAULTS: Light = {
  angle: 152,
  // Off. With envIntensity 0 the Prism look is carried entirely by the rim
  // and by refraction of the shard behind each piece.
  intensity: 0,
  directional: 0.75,
};

/** Unit vector for the key light, shared by the rig and the rim shader. */
function lightVector(light: Light) {
  const a = (light.angle * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(a), Math.sin(a), 0.55).normalize();
}

/** Local studio lighting — lightformers, so nothing is fetched from a CDN. */
function Studio({ light }: { light: Light }) {
  const dir = lightVector(light);
  const key: [number, number, number] = [dir.x * 6, dir.y * 6, dir.z * 6 + 2];

  return (
    <Environment resolution={256}>
      <color attach="background" args={["#0a0a0c"]} />
      {/* Key light. Its position follows the light-angle control, so the
          specular streak and the rim highlight agree with each other. */}
      <Lightformer
        form="rect"
        intensity={9 * light.intensity}
        position={key}
        scale={[7, 7, 1]}
      />
      <Lightformer
        form="rect"
        intensity={2.5 * light.intensity}
        position={[0, 0, 5]}
        scale={[8, 8, 1]}
      />
      <Lightformer
        form="ring"
        intensity={6 * light.intensity}
        color="#8ab4ff"
        position={[-key[0], -key[1], 3]}
        scale={[5, 5, 1]}
      />
      <Lightformer
        intensity={4 * light.intensity}
        position={[0, 5, -4]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[12, 12, 1]}
      />
    </Environment>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="gl-slider">
      <span className="gl-slider-head">
        <span>{label}</span>
        <span className="gl-num">
          {step >= 1 ? value.toFixed(0) : value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

function Swatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="gl-swatch">
      <span>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Lab                                                                 */
/* ------------------------------------------------------------------ */

export default function GlassLab() {
  const [mode, setMode] = useState<Mode>("mosaic");
  const [mosaic, setMosaic] = useState<MosaicParams>(MOSAIC_DEFAULTS);
  const [field, setField] = useState<Field>(FIELD_DEFAULTS);
  const [piece, setPiece] = useState<Piece>(PIECE_DEFAULTS);
  const [light, setLight] = useState<Light>(LIGHT_DEFAULTS);
  const [sheen, setSheen] = useState<Sheen>(SHEEN_DEFAULTS);
  const [core, setCore] = useState<Core>(CORE_DEFAULTS);
  const [params, setParams] = useState<ShapeParams>(SHAPE_DEFAULTS);
  const [glass, setGlass] = useState<Glass>(GLASS_DEFAULTS);
  const [sway, setSway] = useState(true);
  const [tilt, setTilt] = useState(0.28);
  const [bgMode, setBgMode] = useState<BgMode>("shard");
  const [blob, setBlob] = useState<Blob>(BLOB_DEFAULTS);
  const [reveal, setReveal] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const setB = <K extends keyof Blob>(k: K, v: Blob[K]) =>
    setBlob((b) => ({ ...b, [k]: v }));
  const setM = <K extends keyof MosaicParams>(k: K, v: MosaicParams[K]) =>
    setMosaic((m) => ({ ...m, [k]: v }));
  const setF = <K extends keyof Field>(k: K, v: Field[K]) =>
    setField((f) => ({ ...f, [k]: v }));
  const setPc = <K extends keyof Piece>(k: K, v: Piece[K]) =>
    setPiece((c) => ({ ...c, [k]: v }));
  const setL = <K extends keyof Light>(k: K, v: Light[K]) =>
    setLight((l) => ({ ...l, [k]: v }));
  const setSh = <K extends keyof Sheen>(k: K, v: Sheen[K]) =>
    setSheen((x) => ({ ...x, [k]: v }));
  const setC = <K extends keyof Core>(k: K, v: Core[K]) =>
    setCore((x) => ({ ...x, [k]: v }));

  /* ---- saving and restoring a whole look ---- */

  const [lookText, setLookText] = useState("");
  const [lookMsg, setLookMsg] = useState("");

  const currentLook = (): LookState => ({
    version: 1,
    mode,
    bgMode,
    shape: { ...params },
    glass: { ...glass },
    core: { ...core },
    light: { ...light },
    sheen: { ...sheen },
    piece: { ...piece },
    mosaic: { ...mosaic },
    field: { ...field },
    blob: { ...blob },
    sway,
    tilt,
  });

  // Every group is optional, so a partial look only overrides what it names.
  const applyLook = (look: Partial<LookState>) => {
    if (look.mode === "single" || look.mode === "mosaic") setMode(look.mode);
    if (typeof look.bgMode === "string") setBgMode(look.bgMode as BgMode);
    if (look.shape) setParams((v) => ({ ...v, ...(look.shape as ShapeParams) }));
    if (look.glass) setGlass((v) => ({ ...v, ...(look.glass as Glass) }));
    if (look.core) setCore((v) => ({ ...v, ...(look.core as Core) }));
    if (look.light) setLight((v) => ({ ...v, ...(look.light as Light) }));
    if (look.sheen) setSheen((v) => ({ ...v, ...(look.sheen as Sheen) }));
    if (look.piece) setPiece((v) => ({ ...v, ...(look.piece as Piece) }));
    if (look.mosaic) setMosaic((v) => ({ ...v, ...(look.mosaic as MosaicParams) }));
    if (look.field) setField((v) => ({ ...v, ...(look.field as Field) }));
    if (look.blob) setBlob((v) => ({ ...v, ...(look.blob as Blob) }));
    if (typeof look.sway === "boolean") setSway(look.sway);
    if (typeof look.tilt === "number") setTilt(look.tilt);
  };

  const setP = <K extends keyof ShapeParams>(k: K, v: ShapeParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));
  const setG = <K extends keyof Glass>(k: K, v: Glass[K]) =>
    setGlass((g) => ({ ...g, [k]: v }));

  return (
    <div className="gl-root" style={{ background: glass.bg }}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 4.6], fov: 45 }} gl={{ antialias: true }}>
        <color attach="background" args={[glass.bg]} />
        <ambientLight intensity={0.4 * light.intensity} />
        <directionalLight position={[3, 4, 6]} intensity={1.5 * light.intensity} />

        {mode === "mosaic" ? (
          <MosaicScene
            params={mosaic}
            glass={glass}
            field={field}
            piece={piece}
            light={light}
            sheen={sheen}
            core={core}
            sway={sway}
            tilt={tilt}
          />
        ) : (
          <>
            <Backdrop mode={bgMode} base={glass.bg} />
            <GlassShape
              params={params}
              glass={glass}
              blob={blob}
              bgMode={bgMode}
              reveal={reveal}
              light={light}
              core={core}
              sway={sway}
              tilt={tilt}
            />
          </>
        )}
        <Studio light={light} />
      </Canvas>

      <button
        className="gl-toggle"
        onClick={() => setPanelOpen((o) => !o)}
        aria-expanded={panelOpen}
      >
        {panelOpen ? "Hide controls" : "Controls"}
      </button>

      {panelOpen && (
        <aside className="gl-panel">
          <header className="gl-header">
            <h1>{mode === "mosaic" ? "Glass mosaic" : "Glass shape"}</h1>
            <p>
              {mode === "mosaic"
                ? "Voronoi pieces over a hidden colour field."
                : "One flat 2D silhouette, transmission glass."}
            </p>
          </header>

          <section className="gl-section">
            <h2>Saved looks</h2>
            <div className="gl-chips">
              {SAVED_LOOKS.map((l) => (
                <button
                  key={l.name}
                  className="gl-chip"
                  onClick={() => {
                    applyLook(l.state);
                    setLookMsg(`Applied "${l.name}".`);
                  }}
                >
                  {l.name}
                </button>
              ))}
            </div>

            <div className="gl-row">
              <button
                className="gl-reset"
                onClick={() => {
                  const ok = storeLook(currentLook());
                  setLookMsg(
                    ok
                      ? "Saved to this browser."
                      : "Could not save — storage is blocked here."
                  );
                }}
              >
                Save
              </button>
              <button
                className="gl-reset"
                onClick={() => {
                  const stored = loadStoredLook();
                  if (stored) {
                    applyLook(stored);
                    setLookMsg("Restored from this browser.");
                  } else {
                    setLookMsg("Nothing saved in this browser yet.");
                  }
                }}
              >
                Restore
              </button>
            </div>

            <button
              className="gl-reset"
              onClick={() => {
                const json = JSON.stringify(currentLook(), null, 2);
                setLookText(json);
                navigator.clipboard?.writeText(json).then(
                  () => setLookMsg("Copied to clipboard, and shown below."),
                  () => setLookMsg("Shown below — copy it from the box.")
                );
              }}
            >
              Copy settings as JSON
            </button>

            <textarea
              className="gl-json"
              value={lookText}
              spellCheck={false}
              placeholder="Settings JSON appears here. Paste one in and hit Apply to restore it."
              onChange={(e) => setLookText(e.target.value)}
            />

            <button
              className="gl-reset"
              onClick={() => {
                const parsed = parseLook(lookText);
                if (parsed) {
                  applyLook(parsed);
                  setLookMsg("Applied pasted settings.");
                } else {
                  setLookMsg("That is not valid settings JSON.");
                }
              }}
            >
              Apply pasted settings
            </button>

            {lookMsg && <p className="gl-blurb">{lookMsg}</p>}
          </section>

          <section className="gl-section">
            <h2>Look</h2>
            <p className="gl-blurb">
              Refracted glass needs something behind it. This turns the colour
              field on, drops the emissive glow that was flattening the pieces,
              and widens the bevel so the border actually bends light.
            </p>
            <button
              className="gl-reset"
              onClick={() => {
                setField((f) => ({
                  ...f,
                  enabled: true,
                  intensity: 1.5,
                  softness: 0.8,
                  count: 6,
                }));
                setPiece((c) => ({ ...c, glow: 0.06, saturation: 0.7 }));
                setGlass((g) => ({
                  ...g,
                  transmission: 1,
                  thickness: 1.6,
                  ior: 1.5,
                  roughness: 0.12,
                  anisotropicBlur: 0.18,
                  chromaticAberration: 0.12,
                  distortion: 0,
                  envIntensity: 2.2,
                  edgeWidth: 0.8,
                  rimIntensity: 1.5,
                  rimPower: 3.2,
                }));
                setMosaic((m) => ({ ...m, bevel: 0.09, depth: 0.16, gap: 0.05 }));
                setLight(LIGHT_DEFAULTS);
              }}
            >
              Apply refractive look
            </button>
          </section>

          <section className="gl-section">
            <h2>Light</h2>
            <Slider
              label="angle"
              value={light.angle}
              min={0}
              max={360}
              step={1}
              onChange={(v) => setL("angle", v)}
            />
            <Slider
              label="intensity"
              value={light.intensity}
              min={0}
              max={3}
              onChange={(v) => setL("intensity", v)}
            />
            <Slider
              label="rim directionality"
              value={light.directional}
              min={0}
              max={1}
              onChange={(v) => setL("directional", v)}
            />
            <p className="gl-blurb">
              At 0 the rim traces the whole outline evenly — which reads as a
              stroked vector shape. Push it up and the rim brightens on the lit
              side and falls away opposite, the way a real edge does.
            </p>
          </section>

          <section className="gl-section">
            <h2>Mode</h2>
            <div className="gl-chips">
              <button
                className={mode === "mosaic" ? "gl-chip is-on" : "gl-chip"}
                onClick={() => setMode("mosaic")}
              >
                Mosaic
              </button>
              <button
                className={mode === "single" ? "gl-chip is-on" : "gl-chip"}
                onClick={() => setMode("single")}
              >
                Single shape
              </button>
            </div>
          </section>

          {mode === "mosaic" && (
            <>
              <section className="gl-section">
                <h2>Mosaic</h2>
                <Slider
                  label="pieces"
                  value={mosaic.pieces}
                  min={2}
                  max={80}
                  step={1}
                  onChange={(v) => setM("pieces", v)}
                />
                <Slider
                  label="seam"
                  value={mosaic.gap}
                  min={0}
                  max={0.3}
                  onChange={(v) => setM("gap", v)}
                />
                <Slider
                  label="evenness"
                  value={mosaic.evenness}
                  min={0}
                  max={1}
                  onChange={(v) => setM("evenness", v)}
                />
                <Slider
                  label="scatter"
                  value={mosaic.scatter}
                  min={0}
                  max={1.5}
                  onChange={(v) => setM("scatter", v)}
                />
                <Slider
                  label="top raggedness"
                  value={mosaic.topRagged}
                  min={0}
                  max={1}
                  onChange={(v) => setM("topRagged", v)}
                />
                <Slider
                  label="top peaks"
                  value={mosaic.topPeaks}
                  min={2}
                  max={20}
                  step={1}
                  onChange={(v) => setM("topPeaks", v)}
                />
                <p className="gl-blurb">
                  Carves the upper edge against a jagged skyline so the top
                  pieces end in angled faces at different heights. Around 0.5
                  with 6–8 peaks is the roughest; past that the carve starts
                  removing whole pieces and the edge smooths out again.
                </p>
                <Slider
                  label="outline corners"
                  value={mosaic.boundarySides}
                  min={3}
                  max={14}
                  step={1}
                  onChange={(v) => setM("boundarySides", v)}
                />
                <Slider
                  label="outline jitter"
                  value={mosaic.boundaryJitter}
                  min={0}
                  max={1}
                  onChange={(v) => setM("boundaryJitter", v)}
                />
                <Slider
                  label="aspect"
                  value={mosaic.aspect}
                  min={0.3}
                  max={2}
                  onChange={(v) => setM("aspect", v)}
                />
                <Slider
                  label="piece depth"
                  value={mosaic.depth}
                  min={0}
                  max={0.5}
                  onChange={(v) => setM("depth", v)}
                />
                <Slider
                  label="piece bevel"
                  value={mosaic.bevel}
                  min={0}
                  max={0.15}
                  onChange={(v) => setM("bevel", v)}
                />
                <button
                  className="gl-reset"
                  onClick={() =>
                    setM("seed", Math.floor(Math.random() * 100000) + 1)
                  }
                >
                  New break (seed {mosaic.seed})
                </button>
              </section>

              <section className="gl-section">
                <h2>Inner shard</h2>
                <p className="gl-blurb">
                  A smaller, brighter copy of each piece sitting behind it, in
                  that piece&apos;s own hue. The refracted core echoes the
                  outline instead of smearing like a blob. Scale is clamped per
                  piece so it can never peek out, even while spinning.
                </p>
                <label className="gl-check">
                  <input
                    type="checkbox"
                    checked={core.enabled}
                    onChange={(e) => setC("enabled", e.target.checked)}
                  />
                  <span>inner shard behind each piece</span>
                </label>
                {core.enabled && (
                  <>
                    <Slider
                      label="scale"
                      value={core.scale}
                      min={0.05}
                      max={0.95}
                      onChange={(v) => setC("scale", v)}
                    />
                    <Slider
                      label="depth behind"
                      value={core.offset}
                      min={0}
                      max={1.5}
                      onChange={(v) => setC("offset", v)}
                    />
                    <Slider
                      label="brightness"
                      value={core.brightness}
                      min={0}
                      max={5}
                      onChange={(v) => setC("brightness", v)}
                    />
                    <Slider
                      label="spin"
                      value={core.spin}
                      min={-1}
                      max={1}
                      onChange={(v) => setC("spin", v)}
                    />
                      <Slider
                        label="drift"
                        value={core.drift}
                        min={0}
                        max={0.6}
                        onChange={(v) => setC("drift", v)}
                      />
                      <Slider
                        label="drift speed"
                        value={core.driftSpeed}
                        min={0}
                        max={2}
                        onChange={(v) => setC("driftSpeed", v)}
                      />
                  </>
                )}
              </section>

              <section className="gl-section">
                <h2>Sheen</h2>
                <p className="gl-blurb">
                  A gradient running across each piece along the light axis, so
                  one part catches the light and the rest falls to dark. This is
                  what stops a piece reading as one flat colour. The split is
                  offset per piece so the tiles do not all light up together.
                </p>
                <Slider
                  label="intensity"
                  value={sheen.intensity}
                  min={0}
                  max={3}
                  onChange={(v) => setSh("intensity", v)}
                />
                <Slider
                  label="softness"
                  value={sheen.softness}
                  min={0.02}
                  max={1.2}
                  onChange={(v) => setSh("softness", v)}
                />
                <Slider
                  label="split position"
                  value={sheen.bias}
                  min={-0.6}
                  max={0.6}
                  onChange={(v) => setSh("bias", v)}
                />
                <Slider
                  label="per-piece variation"
                  value={sheen.variation}
                  min={0}
                  max={1.2}
                  onChange={(v) => setSh("variation", v)}
                />
                <Slider
                  label="glass tint strength"
                  value={sheen.tint}
                  min={0}
                  max={1}
                  onChange={(v) => setSh("tint", v)}
                />
                <button
                  className="gl-reset"
                  onClick={() =>
                    setSh("seed", Math.floor(Math.random() * 100000) + 1)
                  }
                >
                  Reshuffle sheen
                </button>
              </section>

              <section className="gl-section">
                <h2>Piece colour</h2>
                <p className="gl-blurb">
                  Each piece gets its own hue, walked around the wheel and
                  shuffled so neighbours never match. With a flat background
                  there is nothing behind the glass to tint, so the colour is
                  self-lit — <em>glow</em> is the slider that makes it visible.
                </p>
                <Slider
                  label="hue start"
                  value={piece.hue}
                  min={0}
                  max={360}
                  step={1}
                  onChange={(v) => setPc("hue", v)}
                />
                <Slider
                  label="hue spread"
                  value={piece.spread}
                  min={0}
                  max={360}
                  step={1}
                  onChange={(v) => setPc("spread", v)}
                />
                <Slider
                  label="saturation"
                  value={piece.saturation}
                  min={0}
                  max={1}
                  onChange={(v) => setPc("saturation", v)}
                />
                <Slider
                  label="lightness"
                  value={piece.lightness}
                  min={0.1}
                  max={0.9}
                  onChange={(v) => setPc("lightness", v)}
                />
                <Slider
                  label="glow"
                  value={piece.glow}
                  min={0}
                  max={3}
                  onChange={(v) => setPc("glow", v)}
                />
                <Slider
                  label="hue jitter"
                  value={piece.jitter}
                  min={0}
                  max={0.5}
                  onChange={(v) => setPc("jitter", v)}
                />
                <label className="gl-check">
                  <input
                    type="checkbox"
                    checked={piece.tintGlass}
                    onChange={(e) => setPc("tintGlass", e.target.checked)}
                  />
                  <span>tint the glass too</span>
                </label>
                <label className="gl-check">
                  <input
                    type="checkbox"
                    checked={piece.tintRim}
                    onChange={(e) => setPc("tintRim", e.target.checked)}
                  />
                  <span>rim matches each piece</span>
                </label>
                <p className="gl-blurb">
                  Both off means every piece is the same glass as your Prism —
                  identical tint, attenuation and rim — and the only thing that
                  differs between them is the colour of the shard behind.
                </p>
                <button
                  className="gl-reset"
                  onClick={() =>
                    setPc("seed", Math.floor(Math.random() * 100000) + 1)
                  }
                >
                  Reshuffle colours
                </button>
              </section>

              <section className="gl-section">
                <h2>Colour field</h2>
                <label className="gl-check">
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    onChange={(e) => setF("enabled", e.target.checked)}
                  />
                  <span>enable field behind pieces</span>
                </label>
                <p className="gl-blurb">
                  Optional. Pools of colour on a plane behind the pieces, faded
                  to the page colour before its own edge. Off by default — the
                  background stays flat and colour comes from the pieces.
                </p>
                {field.enabled && (
                <>
                <Slider
                  label="pools"
                  value={field.count}
                  min={1}
                  max={12}
                  step={1}
                  onChange={(v) => setF("count", v)}
                />
                <Slider
                  label="hue start"
                  value={field.hue}
                  min={0}
                  max={360}
                  step={1}
                  onChange={(v) => setF("hue", v)}
                />
                <Slider
                  label="hue spread"
                  value={field.spread}
                  min={0}
                  max={360}
                  step={1}
                  onChange={(v) => setF("spread", v)}
                />
                <Slider
                  label="saturation"
                  value={field.saturation}
                  min={0}
                  max={1}
                  onChange={(v) => setF("saturation", v)}
                />
                <Slider
                  label="pool size"
                  value={field.softness}
                  min={0.15}
                  max={1.4}
                  onChange={(v) => setF("softness", v)}
                />
                <Slider
                  label="intensity"
                  value={field.intensity}
                  min={0}
                  max={2.5}
                  onChange={(v) => setF("intensity", v)}
                />
                <Slider
                  label="drift"
                  value={field.drift}
                  min={0}
                  max={1.2}
                  onChange={(v) => setF("drift", v)}
                />
                <button
                  className="gl-reset"
                  onClick={() =>
                    setF("seed", Math.floor(Math.random() * 100000) + 1)
                  }
                >
                  Reshuffle pools
                </button>
                </>
                )}
              </section>
            </>
          )}

          {mode === "single" && (
          <>
          <section className="gl-section">
            <h2>Presets</h2>
            <div className="gl-chips">
              {SHAPE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className="gl-chip"
                  onClick={() => setParams((p) => ({ ...p, ...preset.params }))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              className="gl-reset"
              onClick={() => setP("seed", Math.floor(Math.random() * 100000) + 1)}
            >
              New outline (seed {params.seed})
            </button>
          </section>

          <section className="gl-section">
            <h2>Outline</h2>
            <Slider
              label="corners"
              value={params.sides}
              min={3}
              max={16}
              step={1}
              onChange={(v) => setP("sides", v)}
            />
            <Slider
              label="irregularity"
              value={params.irregularity}
              min={0}
              max={1}
              onChange={(v) => setP("irregularity", v)}
            />
            <Slider
              label="roundness"
              value={params.roundness}
              min={0}
              max={1}
              onChange={(v) => setP("roundness", v)}
            />
            <Slider
              label="tip"
              value={params.tip}
              min={0}
              max={2.5}
              onChange={(v) => setP("tip", v)}
            />
            <Slider
              label="rotation"
              value={params.rotation}
              min={0}
              max={Math.PI * 2}
              onChange={(v) => setP("rotation", v)}
            />
            <Slider
              label="aspect"
              value={params.aspect}
              min={0.3}
              max={2.2}
              onChange={(v) => setP("aspect", v)}
            />
            <button className="gl-reset" onClick={() => setParams(SHAPE_DEFAULTS)}>
              Reset outline
            </button>
          </section>
          </>
          )}

          <section className="gl-section">
            <h2>Edge</h2>
            {mode === "single" && (
              <>
                <Slider
                  label="depth"
                  value={params.depth}
                  min={0}
                  max={0.6}
                  onChange={(v) => setP("depth", v)}
                />
                <Slider
                  label="bevel"
                  value={params.bevel}
                  min={0}
                  max={0.3}
                  onChange={(v) => setP("bevel", v)}
                />
              </>
            )}
            <label className="gl-check">
              <input
                type="checkbox"
                checked={glass.edges}
                onChange={(e) => setG("edges", e.target.checked)}
              />
              <span>edge highlight</span>
            </label>
            {glass.edges && (
              <Slider
                label="edge width"
                value={glass.edgeWidth}
                min={0.2}
                max={4}
                onChange={(v) => setG("edgeWidth", v)}
              />
            )}
            <label className="gl-check">
              <input
                type="checkbox"
                checked={glass.rim}
                onChange={(e) => setG("rim", e.target.checked)}
              />
              <span>fresnel rim (works with no backdrop)</span>
            </label>
            {glass.rim && (
              <>
                <Slider
                  label="rim intensity"
                  value={glass.rimIntensity}
                  min={0}
                  max={3}
                  onChange={(v) => setG("rimIntensity", v)}
                />
                <Slider
                  label="rim falloff"
                  value={glass.rimPower}
                  min={0.5}
                  max={8}
                  onChange={(v) => setG("rimPower", v)}
                />
              </>
            )}
          </section>

          <section className="gl-section">
            <h2>Glass</h2>
            <Slider
              label="transmission"
              value={glass.transmission}
              min={0}
              max={1}
              onChange={(v) => setG("transmission", v)}
            />
            <Slider
              label="refraction depth"
              value={glass.thickness}
              min={0}
              max={4}
              onChange={(v) => setG("thickness", v)}
            />
            <Slider
              label="frost"
              value={glass.frost}
              min={0}
              max={1}
              onChange={(v) => setG("frost", v)}
            />
            <p className="gl-blurb">
              Drives roughness {frostValues(glass.frost).roughness.toFixed(2)},
              backdrop blur {frostValues(glass.frost).blur.toFixed(2)} and{" "}
              {frostValues(glass.frost).samples} samples together. The sample
              count climbs with the blur so it stays smooth instead of grainy.
            </p>
            <Slider
              label="ior"
              value={glass.ior}
              min={1}
              max={2.4}
              onChange={(v) => setG("ior", v)}
            />
            <Slider
              label="chromatic aberration"
              value={glass.chromaticAberration}
              min={0}
              max={1.5}
              onChange={(v) => setG("chromaticAberration", v)}
            />
            <Slider
              label="distortion"
              value={glass.distortion}
              min={0}
              max={1.5}
              onChange={(v) => setG("distortion", v)}
            />
            <Slider
              label="env intensity"
              value={glass.envIntensity}
              min={0}
              max={5}
              onChange={(v) => setG("envIntensity", v)}
            />
            <Slider
              label="attenuation dist"
              value={glass.attenuationDistance}
              min={0.05}
              max={8}
              onChange={(v) => setG("attenuationDistance", v)}
            />
          </section>

          <section className="gl-section">
            <h2>Colour</h2>
            <div className="gl-swatches">
              <Swatch label="tint" value={glass.color} onChange={(v) => setG("color", v)} />
              <Swatch
                label="interior"
                value={glass.attenuationColor}
                onChange={(v) => setG("attenuationColor", v)}
              />
              <Swatch
                label="edges"
                value={glass.edgeColor}
                onChange={(v) => setG("edgeColor", v)}
              />
              <Swatch
                label="rim"
                value={glass.rimColor}
                onChange={(v) => setG("rimColor", v)}
              />
              <Swatch label="bg" value={glass.bg} onChange={(v) => setG("bg", v)} />
            </div>
          </section>

          {mode === "single" && (
          <section className="gl-section">
            <h2>Behind the glass</h2>
            <div className="gl-chips">
              {BG_MODES.map((m) => (
                <button
                  key={m.key}
                  className={m.key === bgMode ? "gl-chip is-on" : "gl-chip"}
                  onClick={() => setBgMode(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="gl-blurb">
              {BG_MODES.find((m) => m.key === bgMode)!.note}
            </p>

            {bgMode === "shard" && (
              <>
                <Slider
                  label="scale"
                  value={core.scale}
                  min={0.05}
                  max={0.95}
                  onChange={(v) => setC("scale", v)}
                />
                <Slider
                  label="depth behind"
                  value={core.offset}
                  min={0}
                  max={1.5}
                  onChange={(v) => setC("offset", v)}
                />
                <Slider
                  label="brightness"
                  value={core.brightness}
                  min={0}
                  max={5}
                  onChange={(v) => setC("brightness", v)}
                />
                <Slider
                  label="spin"
                  value={core.spin}
                  min={-1}
                  max={1}
                  onChange={(v) => setC("spin", v)}
                />
                  <Slider
                    label="drift"
                    value={core.drift}
                    min={0}
                    max={0.6}
                    onChange={(v) => setC("drift", v)}
                  />
                  <Slider
                    label="drift speed"
                    value={core.driftSpeed}
                    min={0}
                    max={2}
                    onChange={(v) => setC("driftSpeed", v)}
                  />
                <div className="gl-swatches">
                  <Swatch
                    label="core"
                    value={core.color}
                    onChange={(v) => setC("color", v)}
                  />
                </div>
              </>
            )}

            {(bgMode === "blob" || bgMode === "material") && (
              <>
                {bgMode === "blob" && (
                  <>
                    <Slider
                      label="blob size"
                      value={blob.size}
                      min={0.15}
                      max={1.2}
                      onChange={(v) => setB("size", v)}
                    />
                    <Slider
                      label="depth behind"
                      value={blob.offset}
                      min={0}
                      max={2}
                      onChange={(v) => setB("offset", v)}
                    />
                  </>
                )}
                <Slider
                  label="softness"
                  value={blob.softness}
                  min={0.2}
                  max={1.6}
                  onChange={(v) => setB("softness", v)}
                />
                <Slider
                  label="glow intensity"
                  value={blob.intensity}
                  min={0}
                  max={2.5}
                  onChange={(v) => setB("intensity", v)}
                />
                <Slider
                  label="drift"
                  value={blob.drift}
                  min={0}
                  max={1.5}
                  onChange={(v) => setB("drift", v)}
                />
                <div className="gl-swatches">
                  <Swatch
                    label="glow A"
                    value={blob.colorA}
                    onChange={(v) => setB("colorA", v)}
                  />
                  <Swatch
                    label="glow B"
                    value={blob.colorB}
                    onChange={(v) => setB("colorB", v)}
                  />
                </div>
                {bgMode === "blob" && (
                  <label className="gl-check">
                    <input
                      type="checkbox"
                      checked={reveal}
                      onChange={(e) => setReveal(e.target.checked)}
                    />
                    <span>reveal blob (glass → wireframe)</span>
                  </label>
                )}
              </>
            )}
          </section>
          )}

          <section className="gl-section">
            <h2>Scene</h2>
            <label className="gl-check">
              <input
                type="checkbox"
                checked={sway}
                onChange={(e) => setSway(e.target.checked)}
              />
              <span>tilt toward cursor</span>
            </label>
            {sway && (
              <Slider
                label="tilt amount"
                value={tilt}
                min={0}
                max={0.9}
                onChange={setTilt}
              />
            )}
            <button className="gl-reset" onClick={() => setGlass(GLASS_DEFAULTS)}>
              Reset glass
            </button>
          </section>

          <footer className="gl-foot">Move the cursor to catch the light</footer>
        </aside>
      )}
    </div>
  );
}
