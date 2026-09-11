"use client"

import * as React from "react"

import { useHabits } from "@/components/dashboard/habits-context"
import type { SourceRows } from "@/lib/series"
import { toDateKey, todayKey } from "@/lib/stats"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const WEEKS = 26

// Pointy-top hexagons. Columns are weeks, rows are weekdays; odd rows shift
// half a hex right so the grid packs into a honeycomb.
const R = 10
const HEX_W = Math.sqrt(3) * R
const ROW_H = 1.5 * R
const PAD_LEFT = 26 // weekday labels
const PAD_TOP = 16 // month labels
const WIDTH = PAD_LEFT + WEEKS * HEX_W + HEX_W / 2 + 2
const HEIGHT = PAD_TOP + 6 * ROW_H + 2 * R + 2

const TRACKERS = [
  { key: "nutrition", label: "Meals" },
  { key: "gym", label: "Workout" },
  { key: "sleep", label: "Sleep" },
  { key: "weight", label: "Weigh-in" },
  { key: "journal", label: "Journal" },
  { key: "transactions", label: "Money" },
] as const satisfies readonly { key: keyof SourceRows; label: string }[]

// Level 0 is the dark "nothing logged" hex; 1–5 climb toward bright green.
const LEVELS = [
  { label: "Nothing logged", fill: "oklch(1 0 0 / 7%)" },
  { label: "1 thing", fill: "oklch(0.36 0.07 162)" },
  { label: "2 things", fill: "oklch(0.47 0.11 162)" },
  { label: "3 things", fill: "oklch(0.58 0.14 162)" },
  { label: "4 things", fill: "oklch(0.7 0.17 162)" },
  { label: "5+ things", fill: "oklch(0.84 0.16 160)" },
]

function hexPoints(cx: number, cy: number, r: number) {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90)
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(" ")
}

type Day = {
  key: string
  col: number
  row: number
  cx: number
  cy: number
  logged: string[]
  habits: number
  count: number
}

/**
 * A honeycomb calendar of the last six months: one hex per day, brighter the
 * more you tracked. Each tracker with an entry counts once; every habit
 * completed that day counts once more.
 */
export function ActivityHeatmap({ rows }: { rows: SourceRows }) {
  const { completions } = useHabits()
  const [hovered, setHovered] = React.useState<Day | null>(null)

  const { days, months } = React.useMemo(() => {
    const byTracker = new Map<string, Set<string>>()
    for (const t of TRACKERS) {
      byTracker.set(t.key, new Set(rows[t.key].map((r) => r.date.slice(0, 10))))
    }
    const habitsByDay = new Map<string, number>()
    for (const c of completions) {
      habitsByDay.set(c.date, (habitsByDay.get(c.date) ?? 0) + 1)
    }

    // Start on the Sunday WEEKS-1 weeks before this week's Sunday.
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7)
    const todayStr = todayKey()

    const days: Day[] = []
    const months: { col: number; label: string }[] = []
    for (let col = 0; col < WEEKS; col++) {
      for (let row = 0; row < 7; row++) {
        const d = new Date(start)
        d.setDate(start.getDate() + col * 7 + row)
        const key = toDateKey(d)
        if (key > todayStr) break

        if (d.getDate() === 1 || (col === 0 && row === 0)) {
          months.push({
            col,
            label: d.toLocaleString("en-US", { month: "short" }),
          })
        }

        const logged = TRACKERS.filter((t) => byTracker.get(t.key)!.has(key)).map(
          (t) => t.label
        )
        const habits = habitsByDay.get(key) ?? 0
        days.push({
          key,
          col,
          row,
          cx: PAD_LEFT + col * HEX_W + (row % 2 ? HEX_W : HEX_W / 2),
          cy: PAD_TOP + R + row * ROW_H,
          logged,
          habits,
          count: logged.length + habits,
        })
      }
    }
    // A month that starts mid-grid would crowd the first label; drop it.
    if (months.length > 1 && months[1].col - months[0].col < 3) months.shift()
    return { days, months }
  }, [rows, completions])

  const activeDays = days.filter((d) => d.count > 0).length

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Every day for the last six months, brighter the more you tracked.
          </CardDescription>
        </div>
        <span className="flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
          {activeDays} active {activeDays === 1 ? "day" : "days"}
        </span>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="block h-auto w-full"
            role="img"
            aria-label={`Activity heatmap: ${activeDays} active days in the last ${WEEKS} weeks`}
            onPointerLeave={() => setHovered(null)}
          >
            {months.map((m) => (
              <text
                key={`${m.col}-${m.label}`}
                x={PAD_LEFT + m.col * HEX_W + 2}
                y={9}
                className="fill-muted-foreground text-[7px]"
              >
                {m.label}
              </text>
            ))}
            {[
              [1, "Mon"],
              [3, "Wed"],
              [5, "Fri"],
            ].map(([row, label]) => (
              <text
                key={label}
                x={0}
                y={PAD_TOP + R + (row as number) * ROW_H + 2.5}
                className="fill-muted-foreground text-[7px]"
              >
                {label}
              </text>
            ))}

            {/* Dashed crosshair through the hovered hex, as in a map view. */}
            {hovered && (
              <g
                className="pointer-events-none stroke-foreground/25"
                strokeWidth={0.5}
                strokeDasharray="2 2"
              >
                <line x1={PAD_LEFT} x2={WIDTH} y1={hovered.cy} y2={hovered.cy} />
                <line x1={hovered.cx} x2={hovered.cx} y1={PAD_TOP} y2={HEIGHT} />
              </g>
            )}

            {days.map((d) => {
              const level = Math.min(d.count, LEVELS.length - 1)
              const isHovered = hovered?.key === d.key
              return (
                <polygon
                  key={d.key}
                  points={hexPoints(d.cx, d.cy, R - 1)}
                  fill={LEVELS[level].fill}
                  stroke={isHovered ? "white" : "none"}
                  strokeWidth={1.2}
                  className="cursor-pointer transition-[fill]"
                  onPointerEnter={() => setHovered(d)}
                />
              )
            })}
          </svg>

          {hovered && (
            <div
              className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 translate-y-3 rounded-lg border bg-popover/95 p-3 text-xs shadow-xl backdrop-blur"
              style={{
                left: `${(hovered.cx / WIDTH) * 100}%`,
                top: `${(hovered.cy / HEIGHT) * 100}%`,
              }}
            >
              <p className="mb-1.5 font-medium">
                {new Date(`${hovered.key}T00:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              {hovered.count === 0 ? (
                <p className="text-muted-foreground">Nothing logged</p>
              ) : (
                <ul className="grid gap-1 text-muted-foreground">
                  {hovered.logged.map((l) => (
                    <li key={l} className="flex items-center gap-2">
                      <span className="size-2 rounded-[2px] bg-primary" />
                      {l}
                    </li>
                  ))}
                  {hovered.habits > 0 && (
                    <li className="flex items-center gap-2">
                      <span className="size-2 rounded-[2px] bg-primary" />
                      {hovered.habits} {hovered.habits === 1 ? "habit" : "habits"}
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        <ul className="grid shrink-0 grid-cols-3 gap-x-4 gap-y-1.5 rounded-lg border bg-background/40 p-3 text-xs text-muted-foreground lg:grid-cols-1">
          {LEVELS.map((l) => (
            <li key={l.label} className="flex items-center gap-2">
              <span
                className="size-3 rounded-[3px]"
                style={{ background: l.fill }}
              />
              {l.label}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
