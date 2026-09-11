import * as React from "react"

const PILLS = 21
const CX = 150
const CY = 150
const INNER = 94
const OUTER = 140
const PILL_W = 13

/**
 * A half-circle of pills that light up left to right as `value` approaches
 * `max`. Past the max every pill is lit; the label carries the overage.
 */
export function PillGauge({
  value,
  max,
  unit,
  label,
}: {
  value: number
  max: number
  unit: string
  label: string
}) {
  const id = React.useId()
  const ratio = max > 0 ? value / max : 0
  const pct = Math.round(ratio * 100)
  const lit = Math.round(Math.min(1, ratio) * PILLS)
  const over = value - max

  return (
    <div
      className="relative mx-auto w-full max-w-sm"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${label}: ${value.toLocaleString()} of ${max.toLocaleString()} ${unit}`}
    >
      <svg viewBox="0 0 300 168" className="block h-auto w-full">
        <defs>
          {/* Bright at the outer tip, deeper toward the hub — reads as a lit,
              rounded capsule rather than a flat bar. */}
          <linearGradient id={`${id}-on`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.86 0.19 150)" />
            <stop offset="100%" stopColor="oklch(0.6 0.17 155)" />
          </linearGradient>
          <linearGradient id={`${id}-off`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(1 0 0 / 10%)" />
            <stop offset="100%" stopColor="oklch(1 0 0 / 5%)" />
          </linearGradient>
        </defs>

        {Array.from({ length: PILLS }, (_, i) => {
          // -90° is the left end of the arc, +90° the right.
          const angle = -90 + (180 * i) / (PILLS - 1)
          const on = i < lit
          return (
            <g key={i} transform={`rotate(${angle} ${CX} ${CY})`}>
              <rect
                x={CX - PILL_W / 2}
                y={CY - OUTER}
                width={PILL_W}
                height={OUTER - INNER}
                rx={PILL_W / 2}
                fill={`url(#${id}-${on ? "on" : "off"})`}
                className={
                  on
                    ? "drop-shadow-[0_0_6px_oklch(0.8_0.19_152/0.45)]"
                    : undefined
                }
              />
              {/* Specular strip down one side of each lit pill. */}
              {on && (
                <rect
                  x={CX - PILL_W / 2 + 2.5}
                  y={CY - OUTER + 4}
                  width={3}
                  height={OUTER - INNER - 8}
                  rx={1.5}
                  fill="white"
                  opacity={0.35}
                />
              )}
            </g>
          )
        })}

        <text
          x={CX - OUTER + PILL_W / 2}
          y={CY + 16}
          textAnchor="middle"
          className="fill-muted-foreground text-[11px]"
        >
          0
        </text>
        <text
          x={CX + OUTER - PILL_W / 2}
          y={CY + 16}
          textAnchor="middle"
          className="fill-muted-foreground text-[11px]"
        >
          {max.toLocaleString()}
        </text>
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center">
        <p className="text-5xl font-light tracking-tight tabular-nums">
          {pct}
          <span className="text-2xl text-muted-foreground">%</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {over > 0
            ? `${over.toLocaleString()} ${unit} over`
            : `${value.toLocaleString()} of ${max.toLocaleString()} ${unit}`}
        </p>
      </div>
    </div>
  )
}
