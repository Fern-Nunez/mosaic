/**
 * Saving and restoring a whole tuned look.
 *
 * Dialling in glass is a long tail of small numbers across half a dozen
 * groups, and losing them to a page refresh is miserable. A look is the
 * complete state as plain JSON: copy it out, paste it back, or bake it in
 * here as a named preset.
 */

export type LookState = {
  version: 1;
  mode: string;
  bgMode: string;
  shape: Record<string, unknown>;
  glass: Record<string, unknown>;
  core: Record<string, unknown>;
  light: Record<string, unknown>;
  sheen: Record<string, unknown>;
  piece: Record<string, unknown>;
  mosaic: Record<string, unknown>;
  field: Record<string, unknown>;
  blob: Record<string, unknown>;
  sway: boolean;
  tilt: number;
};

export type SavedLook = {
  name: string;
  note?: string;
  /** Partial on purpose — a look only overrides what it cares about. */
  state: Partial<LookState>;
};

const STORAGE_KEY = "mosaic-glass-lab-look";

/** Persist to this browser. Storage can throw (private mode), so guard it. */
export function storeLook(state: LookState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadStoredLook(): LookState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LookState) : null;
  } catch {
    return null;
  }
}

export function parseLook(text: string): LookState | null {
  try {
    const parsed = JSON.parse(text) as LookState;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Baked-in looks.
 *
 * "Prism" is Fern's single-piece look from 2026-08-30. The glass and edge
 * numbers are exact; anything not listed here was not visible when it was
 * transcribed and is left at whatever the panel currently holds.
 */
export const SAVED_LOOKS: SavedLook[] = [
  {
    name: "Prism",
    note: "Single piece. No environment reflections at all — the look is carried entirely by the rim and by refraction of the inner shard.",
    state: {
      mode: "single",
      glass: {
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
      },
      shape: {
        depth: 0.1,
        bevel: 0.05,
      },
    },
  },
  {
    name: "Prism mosaic",
    note: "The same glass across a broken field of pieces, each lit by its own inner shard in its own hue, with a ragged top edge.",
    state: {
      mode: "mosaic",
      glass: {
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
      },
      mosaic: {
        pieces: 22,
        gap: 0.05,
        depth: 0.1,
        bevel: 0.05,
        evenness: 0.6,
        scatter: 0.35,
        // 0.5 / 7 measured as the jaggedest top edge; past that the carve
        // starts deleting the top pieces outright and it smooths back out.
        topRagged: 0.5,
        topPeaks: 7,
      },
      // Each piece is lit from behind by its own shard, so no colour field is
      // needed and the page stays flat between the seams.
      field: { enabled: false },
      core: {
        enabled: true,
        scale: 0.45,
        offset: 0.35,
        brightness: 1.9,
        spin: 0.35,
        drift: 0.12,
        driftSpeed: 0.5,
      },
      // tintGlass/tintRim off: the glass is identical on every piece and the
      // hue lives only in the shard behind it.
      piece: {
        hue: 265,
        spread: 320,
        saturation: 0.75,
        lightness: 0.55,
        glow: 0,
        tintGlass: false,
        tintRim: false,
      },
      sheen: { intensity: 0, softness: 0.55, variation: 0.5, tint: 0.35 },
      light: { intensity: 0, angle: 152, directional: 0.75 },
    },
  },
];
