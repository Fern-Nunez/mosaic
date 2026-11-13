"use client"

import * as React from "react"
import gsap from "gsap"

/**
 * Opens and closes a block under a settings row with GSAP.
 * Open: the space grows in, then the contents fade up into it.
 * Close: the contents fade away, then the space slides shut and unmounts.
 * Respects "reduce motion" (just shows or hides).
 */
export function Reveal({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(open)
  if (open && !mounted) setMounted(true)
  const outer = React.useRef<HTMLDivElement>(null)
  const inner = React.useRef<HTMLDivElement>(null)
  // Skip the open animation for blocks that start open on page load.
  const first = React.useRef(true)

  React.useLayoutEffect(() => {
    const el = outer.current
    const content = inner.current
    const isFirst = first.current
    first.current = false
    if (!mounted || !el || !content) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const ctx = gsap.context(() => {
      if (open) {
        if (isFirst || reduce) return
        gsap
          .timeline()
          .fromTo(el, { height: 0 }, { height: "auto", duration: 0.32, ease: "power2.out" })
          .fromTo(content, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.28, ease: "power2.out" }, "-=0.14")
      } else {
        if (reduce) return setMounted(false)
        gsap
          .timeline({ onComplete: () => setMounted(false) })
          .to(content, { autoAlpha: 0, y: -6, duration: 0.18, ease: "power1.in" })
          .to(el, { height: 0, duration: 0.28, ease: "power2.inOut" })
      }
    })
    return () => ctx.revert()
  }, [open, mounted])

  if (!mounted) return null
  return (
    <div ref={outer} className="overflow-hidden">
      <div ref={inner}>{children}</div>
    </div>
  )
}
