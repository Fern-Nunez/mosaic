"use client"

import * as React from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { chartData, SERIES, seriesMeta, type SeriesId, type SourceRows } from "@/lib/series"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const RANGES = [
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 180, label: "6m" },
  { days: 365, label: "1y" },
]

/**
 * Any two tracked things, on one timeline.
 *
 * Two axes rather than one shared scale: weight sits around 180, calories
 * around 2,000 and mood between 1 and 5. On a single axis everything but the
 * largest series is a flat line at the bottom. Normalising would fix the
 * shape but throw away the numbers, and "your weight was 182" is the point.
 *
 * Two is therefore the hard limit — a third series has no axis to live on.
 */
export function OverlayChart({ rows }: { rows: SourceRows }) {
  const [selected, setSelected] = React.useState<SeriesId[]>([
    "weight",
    "calories",
  ])
  const [days, setDays] = React.useState(90)
  const [smoothing, setSmoothing] = React.useState(7)

  const data = React.useMemo(
    () => chartData(selected, rows, days, smoothing),
    [selected, rows, days, smoothing]
  )

  // Newest selection wins, so clicking a third swaps out the older of the two
  // rather than being silently ignored.
  const toggle = (id: SeriesId) => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id)
      if (cur.length < 2) return [...cur, id]
      return [cur[1], id]
    })
  }

  const [left, right] = selected
  const leftMeta = left ? seriesMeta(left) : null
  const rightMeta = right ? seriesMeta(right) : null

  const hasAny = data.some((d) =>
    selected.some((id) => d[id] != null)
  )

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Compare</CardTitle>
            <CardDescription>
              Put any two things on the same timeline and see whether they move
              together.
            </CardDescription>
          </div>

          <div className="flex items-center gap-1 rounded-md border p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                className={cn(
                  "rounded px-2 py-1 text-xs transition-colors",
                  days === r.days
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SERIES.map((s) => {
            const on = selected.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? "border-transparent text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={on ? { backgroundColor: s.color } : undefined}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: on ? "currentColor" : s.color }}
                />
                {s.label}
              </button>
            )
          })}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-[220px] w-full flex-1">
          {hasAny ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                  tickFormatter={(v: string) =>
                    new Date(v).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  className="text-xs"
                />
                {leftMeta && (
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    domain={["auto", "auto"]}
                    stroke={leftMeta.color}
                    className="text-xs"
                  />
                )}
                {rightMeta && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    domain={["auto", "auto"]}
                    stroke={rightMeta.color}
                    className="text-xs"
                  />
                )}
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) =>
                    new Date(String(v)).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  }
                  formatter={(value, name) => {
                    const meta = seriesMeta(name as SeriesId)
                    const n = Number(value)
                    return [
                      `${meta.unit === "$" ? "$" : ""}${n.toFixed(meta.decimals)}${
                        meta.unit && meta.unit !== "$" ? meta.unit : ""
                      }`,
                      meta.label,
                    ]
                  }}
                />
                {left && leftMeta && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey={left}
                    stroke={leftMeta.color}
                    strokeWidth={2}
                    dot={false}
                    // Logging has gaps; joining across them beats a broken line.
                    connectNulls
                  />
                )}
                {right && rightMeta && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey={right}
                    stroke={rightMeta.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              {selected.length === 0
                ? "Pick something to plot."
                : "Nothing logged for this range yet."}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {leftMeta && rightMeta
              ? `${leftMeta.label} on the left, ${rightMeta.label} on the right.`
              : "Pick a second thing to compare against."}
          </span>

          <label className="flex items-center gap-2">
            Smoothing
            <select
              value={smoothing}
              onChange={(e) => setSmoothing(Number(e.target.value))}
              className="rounded border bg-transparent px-1.5 py-0.5"
            >
              <option value={1}>None</option>
              <option value={7}>7 day</option>
              <option value={14}>14 day</option>
            </select>
          </label>
        </div>
      </CardContent>
    </Card>
  )
}
