/**
 * Tiny module-level signal for "the 3D is up".
 *
 * The loader overlay and the hero canvas do not share a React tree — both sit
 * under server components — so a module singleton is the least invasive way
 * for one to tell the other. No context plumbing through the page.
 */

const done = new Set();
const listeners = new Set();

/** Called by whichever piece finished a step. Repeat calls are harmless. */
export function markReady(key) {
  if (done.has(key)) return;
  done.add(key);
  for (const fn of listeners) fn(new Set(done));
}

/** Subscribe. Fires immediately with whatever is already done. */
export function onReady(fn) {
  listeners.add(fn);
  fn(new Set(done));
  return () => listeners.delete(fn);
}

/** Reset between hot reloads in development. */
export function resetReady() {
  done.clear();
}

/* ------------------------------------------------------------------ */

/**
 * Whether the overlay has lifted.
 *
 * Anything above the fold animates the moment it mounts, which is while the
 * overlay is still covering the page — so the animation plays out unseen.
 * Those pieces wait for this instead.
 */
let dismissed = false;
const dismissListeners = new Set();

export function markDismissed() {
  if (dismissed) return;
  dismissed = true;
  for (const fn of dismissListeners) fn();
  dismissListeners.clear();
}

/** Calls back once the overlay is gone, or immediately if it already is. */
export function onDismissed(fn) {
  if (dismissed) {
    fn();
    return () => {};
  }
  dismissListeners.add(fn);
  return () => dismissListeners.delete(fn);
}
