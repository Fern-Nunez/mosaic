import * as React from "react"

const PILLS = 25
const CX = 160
const CY = 158
const INNER = 104
const OUTER = 150
const PILL_W = 12

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
  const left = max - value

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div
        className="relative"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${value.toLocaleString()} of ${max.toLocaleString()} ${unit}`}
      >
        <svg viewBox="0 0 320 166" className="block h-auto w-full">
          <defs>
            {/* Bright at the outer tip, deeper toward the hub — reads as a
                lit, rounded capsule rather than a flat bar. */}
            <linearGradient id={`${id}-on`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.88 0.19 150)" />
              <stop offset="100%" stopColor="oklch(0.62 0.17 155)" />
            </linearGradient>
            <linearGradient id={`${id}-off`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(1 0 0 / 9%)" />
              <stop offset="100%" stopColor="oklch(1 0 0 / 4%)" />
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
                  stroke={on ? "none" : "oklch(1 0 0 / 6%)"}
                  strokeWidth={1}
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
                    width={2.5}
                    height={OUTER - INNER - 8}
                    rx={1.25}
                    fill="white"
                    opacity={0.35}
                  />
                )}
              </g>
            )
          })}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <p className="text-5xl font-light tracking-tight tabular-nums sm:text-6xl">
            {pct}
            <span className="text-2xl text-muted-foreground sm:text-3xl">%</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">of goal</p>
        </div>
      </div>

      <div className="flex justify-between px-1 text-xs text-muted-foreground tabular-nums">
        <span>0</span>
        <span>
          {max.toLocaleString()} {unit}
        </span>
      </div>

      <dl className="grid grid-cols-3 divide-x rounded-lg border bg-background/40 text-center">
        {[
          { term: "Eaten", value: value.toLocaleString() },
          {
            term: left >= 0 ? "Left" : "Over",
            value: Math.abs(left).toLocaleString(),
          },
          { term: "Goal", value: max.toLocaleString() },
        ].map((row) => (
          <div key={row.term} className="px-2 py-2.5">
            <dt className="text-xs text-muted-foreground">{row.term}</dt>
            <dd className="text-sm font-medium tabular-nums">
              {row.value}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                {unit}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
