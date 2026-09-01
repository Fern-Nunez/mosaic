"use client";

import { useEffect } from "react";
import { markReady } from "./ready";

/**
 * Reports the two milestones that are not owned by the 3D scene itself:
 * the fonts, and the scene's JS chunk having arrived.
 *
 * Mounted alongside the loader. The canvas and frames steps are reported
 * from inside the scene, where they actually happen.
 */
export default function LoaderSignals() {
  useEffect(() => {
    // Six families load in the root layout; text reflowing after the
    // overlay lifts is exactly the kind of thing it exists to hide.
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => markReady("fonts"));
    } else {
      markReady("fonts");
    }

    // three + drei is the heavy part of the bundle. Importing it here
    // resolves once it has downloaded and parsed — and because the hero's
    // canvas imports the same chunk, this does not fetch anything twice.
    import("@/components/web/glass/scene")
      .then(() => markReady("chunk"))
      .catch(() => markReady("chunk"));
  }, []);

  return null;
}
