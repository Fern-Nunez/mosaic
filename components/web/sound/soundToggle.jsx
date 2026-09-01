"use client";

import { useEffect, useRef, useState } from "react";
import "./sound.css";
import {
  getState,
  restore,
  setEnabled,
  subscribe,
  toggle,
  watchHovers,
  watchVisibility,
} from "./audio";

function SpeakerOn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function SpeakerOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="m16 9 5 6" />
      <path d="m21 9-5 6" />
    </svg>
  );
}

/**
 * Bottom-right sound control.
 *
 * The click is doing double duty: it is the visitor's consent, and it is the
 * user gesture browsers require before any audio may start. That is why the
 * music cannot simply begin on load.
 *
 * A remembered "on" choice is restored as a *pending* state rather than
 * played, since a fresh page load has had no gesture yet — the next click
 * anywhere on the page starts it.
 */
export default function SoundToggle() {
  const [state, setState] = useState(getState);
  const buttonRef = useRef(null);
  const disarmRef = useRef(null);

  useEffect(() => subscribe(setState), []);
  useEffect(() => watchVisibility(), []);
  useEffect(() => watchHovers(), []);

  // Someone who had it on last visit almost certainly wants it on again, but
  // we still need a gesture — so arm it and let their first click start it.
  useEffect(() => {
    if (!restore()) return;

    const disarm = () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      disarmRef.current = null;
    };

    function start(event) {
      // Ignore the toggle's own click. pointerdown lands before click, so
      // arming would switch sound on and the click would then switch it
      // straight back off.
      if (event.target instanceof Node && buttonRef.current?.contains(event.target)) {
        return;
      }
      disarm();
      setEnabled(true);
    }

    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    disarmRef.current = disarm;
    return disarm;
  }, []);

  // Shown whether or not the file resolves; `available` only reports it.
  const on = state.enabled;

  return (
    <button
      type="button"
      ref={buttonRef}
      className={`soundToggle${on ? " is-on" : ""}`}
      onClick={() => {
        // An explicit choice ends the arming, or a later click elsewhere
        // would switch sound back on against it.
        disarmRef.current?.();
        toggle();
      }}
      aria-pressed={on}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      title={on ? "Sound on" : "Sound off"}
    >
      {on ? <SpeakerOn /> : <SpeakerOff />}
    </button>
  );
}
