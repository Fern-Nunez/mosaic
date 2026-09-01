/**
 * Background music, as a module singleton.
 *
 * Deliberately off by default. Browsers block audio until the visitor has
 * interacted with the page, so it *cannot* start on load — and unannounced
 * music is the fastest way to lose someone anyway. The toggle click is both
 * the consent and the gesture the browser requires.
 *
 * Drop a real file at MUSIC_SRC and it works; nothing else needs changing.
 */

export const MUSIC_SRC = "/audio/ambient.mp3";

const STORAGE_KEY = "mosaic-sound";
/** Quiet enough to sit under the page rather than on top of it. */
const VOLUME = 0.22;
const FADE_MS = 600;

let el = null;
let enabled = false;
let available = true;
let fadeTimer = null;
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn({ enabled, available });
}

function element() {
  if (el || typeof window === "undefined") return el;

  el = new Audio(MUSIC_SRC);
  el.loop = true;
  el.preload = "none";
  el.volume = 0;

  // A missing file should not make the control vanish — it stays visible
  // and inert so dropping the real asset in later just works.
  el.addEventListener("error", () => {
    available = false;
    enabled = false;
    notify();
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[sound] could not load ${MUSIC_SRC} — the toggle stays visible but ` +
          `will do nothing until a file exists there.`
      );
    }
  });

  return el;
}

/** Ramp rather than cut — a hard start on a music bed is jarring. */
function fadeTo(target, onDone) {
  const audio = element();
  if (!audio) return;

  clearInterval(fadeTimer);
  const from = audio.volume;
  const started = performance.now();

  fadeTimer = setInterval(() => {
    const t = Math.min(1, (performance.now() - started) / FADE_MS);
    audio.volume = from + (target - from) * t;
    if (t === 1) {
      clearInterval(fadeTimer);
      onDone?.();
    }
  }, 16);
}

export function getState() {
  return { enabled, available };
}

export function subscribe(fn) {
  listeners.add(fn);
  fn({ enabled, available });
  return () => listeners.delete(fn);
}

/** Reads the remembered choice. Does not start playback — that needs a click. */
export function restore() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function remember(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  } catch {
    // Private mode and blocked storage are fine; the choice just will not
    // survive a reload.
  }
}

/** Must be called from a user gesture the first time, or the browser refuses. */
export async function setEnabled(next) {
  const audio = element();
  if (!audio) return;

  enabled = next;
  remember(next);
  notify();

  if (next) {
    try {
      audio.volume = 0;
      await audio.play();
      fadeTo(VOLUME);
      prepareNote();
    } catch {
      // Autoplay refused, or the file is missing.
      enabled = false;
      notify();
    }
  } else {
    fadeTo(0, () => audio.pause());
  }
}

export function toggle() {
  return setEnabled(!enabled);
}

/** Silence while the tab is in the background, resume on return. */
export function watchVisibility() {
  if (typeof document === "undefined") return () => {};

  const onChange = () => {
    const audio = element();
    if (!audio || !enabled) return;
    if (document.hidden) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/* ------------------------------------------------------------------ */
/* Hover note                                                          */
/* ------------------------------------------------------------------ */

export const NOTE_SRC = "/audio/pop.mp3";

/** Quieter than the music — it fires often. */
const NOTE_VOLUME = 0.3;
/** Sweeping a cursor across a navbar would otherwise machine-gun. */
const NOTE_THROTTLE_MS = 90;

let ctx = null;
let noteBuffer = null;
let noteGain = null;
let lastNoteAt = 0;
/** Seconds of silence at the head of the file, skipped on playback. */
let noteOffset = 0;

/**
 * Short sounds go through Web Audio rather than an <audio> element.
 *
 * A media element can only play one instance at a time, so moving quickly
 * across several links would cut the sound off and restart it, with audible
 * latency each time. Decoding once into a buffer and firing a cheap source
 * per hover lets them overlap and start instantly.
 */
async function prepareNote() {
  if (noteBuffer || typeof window === "undefined") return;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;

  ctx = ctx || new Ctx();
  noteGain = noteGain || ctx.createGain();
  noteGain.gain.value = NOTE_VOLUME;
  noteGain.connect(ctx.destination);

  try {
    const res = await fetch(NOTE_SRC);
    if (!res.ok) throw new Error(String(res.status));
    noteBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
    noteOffset = leadingSilence(noteBuffer);
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[sound] no hover note at ${NOTE_SRC} — hovers stay silent.`);
    }
  }
}

/**
 * Where the sound actually starts.
 *
 * Exported audio very often carries a few tens of milliseconds of silence at
 * the head. Played from 0 that reads as input lag on a hover sound, so find
 * the first audible sample once and start from there instead.
 */
function leadingSilence(buffer) {
  const data = buffer.getChannelData(0);
  const limit = Math.min(data.length, buffer.sampleRate); // no need to scan past 1s
  for (let i = 0; i < limit; i++) {
    if (Math.abs(data[i]) > 0.01) return i / buffer.sampleRate;
  }
  return 0;
}

/** Safe to call on every hover; it no-ops until everything is ready. */
export function playNote() {
  if (!enabled || !noteBuffer || !ctx) return;

  const now = performance.now();
  if (now - lastNoteAt < NOTE_THROTTLE_MS) return;
  lastNoteAt = now;

  // The context suspends itself when the tab is idle.
  if (ctx.state === "suspended") ctx.resume();

  const src = ctx.createBufferSource();
  src.buffer = noteBuffer;
  // Identical repeats sound mechanical; a little pitch scatter does not.
  src.playbackRate.value = 0.97 + Math.random() * 0.06;
  src.connect(noteGain);
  src.start(0, noteOffset);
}

/**
 * Hover notes for anything clickable.
 *
 * Delegated from the document so nothing has to be wired per component, and
 * limited to real pointers — on a touchscreen `pointerover` fires on tap,
 * which would sound on every press as well as the tap itself.
 */
export function watchHovers() {
  if (typeof document === "undefined") return () => {};
  if (!window.matchMedia("(pointer: fine)").matches) return () => {};

  let last = null;

  const onOver = (event) => {
    const hit = event.target.closest?.("a, button, [role='button'], [data-sound]");
    if (!hit || hit === last) return;
    last = hit;
    playNote();
  };

  const onOut = (event) => {
    if (event.target === last) last = null;
  };

  document.addEventListener("pointerover", onOver);
  document.addEventListener("pointerout", onOut);
  return () => {
    document.removeEventListener("pointerover", onOver);
    document.removeEventListener("pointerout", onOut);
  };
}

/** Called once the visitor has turned sound on, which is also the gesture
 *  Web Audio needs before it will produce anything. */
export function primeNote() {
  return prepareNote();
}
