/* Custom Recharts ticks so charts can run to the card edges. */

type TickProps = {
  x?: number | string
  y?: number | string
  index?: number
  visibleTicksCount?: number
  payload?: { value: string | number }
}

/**
 * Category label pinned to the card's left edge (Recharts right-aligns them
 * to the axis by default, which leaves short labels floating inward).
 */
export function StartTick({ y, payload }: TickProps) {
  return (
    <text x={0} y={y} dy={4} textAnchor="start" fontSize={12} className="fill-muted-foreground">
      {payload?.value}
    </text>
  )
}

/** X label whose first and last ticks hug the edges instead of being cut off. */
export function EdgeXTick({ x, y, payload, index = 0, visibleTicksCount = 0 }: TickProps) {
  const anchor = visibleTicksCount > 1 && index === 0 ? "start" : visibleTicksCount > 1 && index === visibleTicksCount - 1 ? "end" : "middle"
  // Nudge the end labels back toward the bar/point they belong to.
  const dx = anchor === "start" ? -4 : anchor === "end" ? 4 : 0
  return (
    <text x={Number(x) + dx} y={y} dy={12} textAnchor={anchor} fontSize={12} className="fill-muted-foreground">
      {payload?.value}
    </text>
  )
}

/**
 * Y value drawn inside the chart, just above its grid line, with a halo in
 * the card color so it stays readable where it crosses a bar or line.
 */
export function InsideYTick({ y, payload, format }: TickProps & { format?: (v: number) => string }) {
  const v = Number(payload?.value)
  if (!Number.isFinite(v) || v === 0) return null
  return (
    <text
      x={0}
      y={y}
      dy={-5}
      textAnchor="start"
      fontSize={11}
      className="fill-muted-foreground stroke-white [paint-order:stroke] dark:stroke-neutral-900"
      strokeWidth={3}
      strokeLinejoin="round"
    >
      {format ? format(v) : String(v)}
    </text>
  )
}
