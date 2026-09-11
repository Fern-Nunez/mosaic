"use client"

import * as React from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent"

import { chartData, SERIES, seriesMeta, type SeriesId, type SourceRows } from "@/lib/series"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const RANGES = [
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 180, label: "6m" },
  { value: 365, label: "1y" },
]

const SMOOTHING = [
  { value: 1, label: "Off" },
  { value: 7, label: "7d" },
  { value: 14, label: "14d" },
]

const NONE = "none"

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

/** "2026-07-16" parsed as a local date — a bare ISO date is UTC midnight. */
function localDate(key: string) {
  return new Date(`${key}T00:00`)
}

function formatValue(id: SeriesId, value: number) {
  const meta = seriesMeta(id)
  const n = value.toLocaleString("en-US", {
    maximumFractionDigits: meta.decimals,
    minimumFractionDigits: meta.decimals,
  })
  if (meta.unit === "$") return `$${n}`
  return meta.unit ? `${n}${meta.unit}` : n
}

function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: number; label: string }[]
  value: number
  onChange: (value: number) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-lg border bg-background/40 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors",
            value === o.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SeriesSelect({
  value,
  onChange,
  allowNone,
  label,
}: {
  value: SeriesId | typeof NONE
  onChange: (value: SeriesId | typeof NONE) => void
  allowNone?: boolean
  label: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as SeriesId | typeof NONE)
      }}
    >
      <SelectTrigger aria-label={label} className="min-w-0 flex-1 sm:w-44 sm:flex-none">
        <SelectValue>
          {(v: string) =>
            v === NONE ? (
              <span className="text-muted-foreground">Nothing</span>
            ) : (
              <>
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: seriesMeta(v as SeriesId).color }}
                />
                {seriesMeta(v as SeriesId).label}
              </>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>Nothing</SelectItem>}
        {SERIES.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-36 rounded-lg border bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1.5 font-medium">
        {localDate(String(label)).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </p>
      <ul className="grid gap-1">
        {payload.map((p) => {
          const id = p.dataKey as SeriesId
          const meta = seriesMeta(id)
          return (
            <li key={id} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                {meta.label}
              </span>
              <span className="font-medium tabular-nums">
                {p.value == null ? "—" : formatValue(id, Number(p.value))}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

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
  const [left, setLeft] = React.useState<SeriesId>("weight")
  const [right, setRight] = React.useState<SeriesId | typeof NONE>("calories")
  const [days, setDays] = React.useState(90)
  const [smoothing, setSmoothing] = React.useState(7)
  const id = React.useId()

  const selected = React.useMemo(
    () => (right === NONE ? [left] : [left, right]),
    [left, right]
  )

  const data = React.useMemo(
    () => chartData(selected, rows, days, smoothing),
    [selected, rows, days, smoothing]
  )

  // Picking what the other side already shows swaps them, so the two
  // dropdowns can never end up plotting the same thing twice.
  const pickLeft = (v: SeriesId | typeof NONE) => {
    if (v === NONE) return
    if (v === right) setRight(left)
    setLeft(v)
  }
  const pickRight = (v: SeriesId | typeof NONE) => {
    if (v === left) {
      if (right === NONE) return
      setLeft(right)
    }
    setRight(v)
  }

  const leftMeta = seriesMeta(left)
  const rightMeta = right === NONE ? null : seriesMeta(right)
  const hasAny = data.some((d) => selected.some((s) => d[s] != null))

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Compare</CardTitle>
            <CardDescription>
              See whether two things move together.
            </CardDescription>
          </div>
          <Segmented
            label="Date range"
            options={RANGES}
            value={days}
            onChange={setDays}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <SeriesSelect label="First series" value={left} onChange={pickLeft} />
          <span className="text-muted-foreground">vs</span>
          <SeriesSelect
            label="Second series"
            value={right}
            onChange={pickRight}
            allowNone
          />
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="h-64 w-full sm:h-80">
          {hasAny ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                <defs>
                  {[leftMeta, rightMeta].map(
                    (m) =>
                      m && (
                        <linearGradient
                          key={m.id}
                          id={`${id}-${m.id}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={m.color} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                        </linearGradient>
                      )
                  )}
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tickMargin={8}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(v: string) =>
                    localDate(v).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickCount={5}
                  domain={["auto", "auto"]}
                  tick={{ fill: leftMeta.color, fontSize: 11 }}
                  tickFormatter={(v: number) => compact.format(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  hide={!rightMeta}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickCount={5}
                  domain={["auto", "auto"]}
                  tick={{ fill: rightMeta?.color, fontSize: 11 }}
                  tickFormatter={(v: number) => compact.format(v)}
                />
                <Tooltip
                  content={ChartTooltip}
                  cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey={left}
                  stroke={leftMeta.color}
                  strokeWidth={2}
                  fill={`url(#${id}-${left})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  // Logging has gaps; joining across them beats a broken line.
                  connectNulls
                  isAnimationActive={false}
                />
                {rightMeta && (
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey={rightMeta.id}
                    stroke={rightMeta.color}
                    strokeWidth={2}
                    fill={`url(#${id}-${rightMeta.id})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              Nothing logged for this range yet.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: leftMeta.color }}
              />
              {leftMeta.label} · left axis
            </span>
            {rightMeta && (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-0.5 w-3 rounded-full"
                  style={{ backgroundColor: rightMeta.color }}
                />
                {rightMeta.label} · right axis
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>Smoothing</span>
            <Segmented
              label="Smoothing"
              options={SMOOTHING}
              value={smoothing}
              onChange={setSmoothing}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
