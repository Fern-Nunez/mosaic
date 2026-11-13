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
 * X label tilted 45°, hanging down-left from its tick, so dates like
 * "Nov 12" never run into their neighbors.
 */
export function AngledXTick({ x, y, payload }: TickProps) {
  return (
    <text
      x={Number(x)}
      y={Number(y)}
      dy={10}
      textAnchor="end"
      fontSize={11}
      transform={`rotate(-45 ${Number(x)} ${Number(y) + 10})`}
      className="fill-muted-foreground"
    >
      {payload?.value}
    </text>
  )
}

/**
 * Y value in its own strip left of the chart, pinned to the card's left
 * edge so it lines up with the title and subtitle above.
 */
export function LeftYTick({ y, payload, format }: TickProps & { format?: (v: number) => string }) {
  const v = Number(payload?.value)
  if (!Number.isFinite(v)) return null
  return (
    <text x={0} y={Number(y)} dy={4} textAnchor="start" fontSize={11} className="fill-muted-foreground">
      {format ? format(v) : String(v)}
    </text>
  )
}
