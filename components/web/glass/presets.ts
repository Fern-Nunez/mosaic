import type { MosaicParams } from "@/lib/glass/mosaic";
import type { ShapeParams } from "@/lib/glass/shape2d";

/**
 * Looks exported from the tuning lab at /test.
 *
 * To add or change one: open /test, tune it, hit "Copy settings as JSON",
 * and paste the result in here as a new entry. The field names match the
 * lab's exactly, so it is a straight paste.
 */

export type GlassConfig = {
  variant: "single" | "mosaic";
  shape: ShapeParams;
  mosaic: MosaicParams;
  glass: {
    transmission: number;
    thickness: number;
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
  core: {
    enabled: boolean;
    scale: number;
    offset: number;
    brightness: number;
    spin: number;
    drift: number;
    driftSpeed: number;
    color: string;
  };
  light: { angle: number; intensity: number; directional: number };
  piece: {
    hue: number;
    spread: number;
    saturation: number;
    lightness: number;
    glow: number;
    jitter: number;
    seed: number;
    tintRim: boolean;
    tintGlass: boolean;
  };
  /** Cursor tilt. */
  sway: boolean;
  tilt: number;
};

const GLASS = {
  transmission: 1,
  thickness: 2.79,
  frost: 0.5,
  ior: 1.41,
  chromaticAberration: 0.27,
  distortion: 1.5,
  // No environment reflections: the surface is carried entirely by the
  // fresnel rim and by refraction of the shard behind it.
  envIntensity: 0,
  attenuationDistance: 3.34,
  edges: true,
  edgeWidth: 0.8,
  rim: true,
  rimIntensity: 1.5,
  rimPower: 3.2,
  color: "#ffffff",
  // Cool blues. These hold the overall brightness down as well as tinting —
  // a white attenuation lets everything through and reads much hotter.
  attenuationColor: "#a8c6ff",
  edgeColor: "#e2ecff",
  rimColor: "#9dc0ff",
  bg: "#171717",
};

const SHAPE: ShapeParams = {
  sides: 5,
  irregularity: 0.45,
  roundness: 0,
  tip: 0.6,
  rotation: 0.2,
  aspect: 1,
  depth: 0.1,
  bevel: 0.05,
  seed: 7,
};

const PIECE = {
  hue: 265,
  spread: 320,
  saturation: 0.7,
  lightness: 0.55,
  glow: 0.06,
  jitter: 0.12,
  seed: 5,
  // Both off: every piece is identical glass, and the only thing that
  // differs between them is the colour of the shard behind it.
  tintRim: false,
  tintGlass: false,
};

/** A single shard. Cheap — one transmissive mesh. */
export const prism: GlassConfig = {
  variant: "single",
  shape: SHAPE,
  mosaic: {
    pieces: 20,
    boundarySides: 7,
    boundaryJitter: 0.28,
    aspect: 0.84,
    gap: 0.05,
    depth: 0,
    bevel: 0.03,
    evenness: 0,
    scatter: 0,
    topRagged: 0.24,
    topPeaks: 7,
    seed: 12,
  },
  glass: GLASS,
  core: {
    enabled: true,
    scale: 0.45,
    offset: 0.35,
    brightness: 1.9,
    // ~12s per revolution, plus a slow orbit so the colour moves across the
    // shard rather than just turning in place.
    spin: 0.5,
    drift: 0.1,
    driftSpeed: 0.6,
    color: "#66d9ff",
  },
  light: { angle: 152, intensity: 0.08, directional: 0.75 },
  piece: PIECE,
  sway: true,
  tilt: 0.28,
};

/** The broken field. ~20 transmissive meshes — heavier; see the README note. */
export const prismMosaic: GlassConfig = {
  ...prism,
  variant: "mosaic",
  // Much less cursor lean than the single shard. As a full-bleed background
  // behind text, 0.28 reads as the whole page swaying.
  tilt: 0.09,
  core: {
    enabled: true,
    scale: 0.45,
    offset: 0.35,
    brightness: 1.9,
    // As saved. Use the `speed` prop for livelier motion without editing this.
    spin: 0.35,
    drift: 0.12,
    driftSpeed: 0.5,
    color: "#66d9ff",
  },
  light: { angle: 152, intensity: 0, directional: 0.75 },
};

export const PRESETS = { prism, prismMosaic };

export type PresetName = keyof typeof PRESETS;
