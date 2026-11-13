"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  LabelList,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import { AngledXTick, EdgeXTick, LeftYTick } from "@/components/app/chart-ticks"
import { EntryEditor, type EntryEdit } from "@/components/app/trends/entry-editor"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import type { Bucket, Month } from "@/lib/app/dates"
import { dateKey, inRange, keyToDate } from "@/lib/app/dates"
import { cn } from "@/lib/utils"

/* Building blocks for the category pages. */

export function Panel({
  title,
  subtitle,
  children,
}: {
  title?: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 glass rounded-2xl p-5">
      {(title || subtitle) && (
        <div>
          {title && <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>}
          {subtitle && <p className="text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

/** 2-up grid of small numbers at the top of a category page. */
export function StatGrid({ stats }: { stats: { label: string; value: string; hint?: string }[] }) {
  return (
    // An odd last card spans the full row instead of leaving a gap.
    <div className="grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 glass rounded-2xl p-4">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{s.label}</span>
          <span className="text-xl font-medium tracking-tight tabular-nums text-neutral-900 dark:text-neutral-100">
            {s.value}
          </span>
          {s.hint && <span className="text-xs text-neutral-500 dark:text-neutral-400">{s.hint}</span>}
        </div>
      ))}
    </div>
  )
}

/** One column per day/week/month. */
export function ColumnChart({
  buckets,
  series,
  format,
  goal,
  goalLabel,
}: {
  buckets: Bucket[]
  series: { key: string; label: string; color: string; values: number[] }[]
  format?: (v: number) => string
  goal?: number
  goalLabel?: string
}) {
  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  ) satisfies ChartConfig
  const data = buckets.map((b, i) => ({
    label: b.label,
    ...Object.fromEntries(series.map((s) => [s.key, Number.isFinite(s.values[i]) ? s.values[i] : 0])),
  }))
  // Dates tilt 45° so they never collide; with lots of them, show about one in four.
  const angled = buckets.length > 4
  const interval = buckets.length > 14 ? Math.ceil(buckets.length / 8) - 1 : 0

  return (
    <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
      <BarChart data={data} margin={{ top: 16, left: 0, right: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={interval} height={angled ? 46 : 30} tick={angled ? <AngledXTick /> : <EdgeXTick />} padding={{ left: 8, right: 0 }} />
        {/* Y labels in their own strip on the left; grid lines start right of them. */}
        <YAxis width={30} tickLine={false} axisLine={false} tickMargin={6} tick={<LeftYTick format={format} />} />
        {goal !== undefined && goal > 0 && (
          <ReferenceLine
            y={goal}
            strokeDasharray="4 4"
            className="stroke-neutral-400 dark:stroke-neutral-500"
            label={goalLabel ? { value: goalLabel, position: "insideTopRight", fontSize: 11, className: "fill-neutral-500" } : undefined}
          />
        )}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={`var(--color-${s.key})`}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

/** Horizontal bars with the value at the end, for breakdowns. */
export function BreakdownBars({
  rows,
  color,
  format,
}: {
  rows: { label: string; value: number; color?: string }[]
  color: string
  format?: (v: number) => string
}) {
  if (!rows.length) return null
  const max = Math.max(...rows.map((r) => r.value), 0) || 1
  // Plain rows: the label gets its own column (cut off with … if long), so
  // it can never run into the bar.
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="flex h-8 items-center gap-3">
          <span title={r.label} className="w-[38%] shrink-0 truncate text-sm text-neutral-500 dark:text-neutral-400">
            {r.label}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="h-7 min-w-1.5 rounded-md"
              style={{ width: `calc((100% - 3.25rem) * ${r.value / max})`, backgroundColor: r.color ?? color }}
            />
            <span className="shrink-0 text-xs tabular-nums text-neutral-900 dark:text-neutral-100">{format ? format(r.value) : r.value}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Line through individual entries (e.g. weigh-ins), labels when there's room. */
export function PointLine({
  points,
  color,
  format,
  goal,
}: {
  points: { date: string; value: number }[]
  color: string
  format?: (v: number) => string
  /** Optional dashed goal line (e.g. goal weight). */
  goal?: number
}) {
  const config = { value: { label: "Value", color } } satisfies ChartConfig
  const data = points.map((p) => ({
    ...p,
    label: keyToDate(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }))
  const showLabels = points.length <= 10
  return (
    <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
      <LineChart data={data} margin={{ top: 24, left: 0, right: 0 }}>
        <CartesianGrid vertical={false} />
        {/* Padding inside the plot keeps end labels on screen while the grid
            lines still run the full width. */}
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          height={46}
          tick={<AngledXTick />}
          // Room on the left for the first date, which hangs down-left when tilted.
          padding={{ left: 28, right: 24 }}
          interval={points.length > 10 ? Math.ceil(points.length / 8) - 1 : 0}
        />
        <YAxis
          hide
          domain={
            goal !== undefined
              ? [(min: number) => Math.min(min, goal) - 1, (max: number) => Math.max(max, goal) + 1]
              : ["dataMin - 1", "dataMax + 1"]
          }
        />
        {goal !== undefined && (
          <ReferenceLine
            y={goal}
            strokeDasharray="4 4"
            className="stroke-neutral-400 dark:stroke-neutral-500"
            label={{ value: `Goal ${goal}`, position: "insideBottomRight", fontSize: 11, className: "fill-neutral-500" }}
          />
        )}
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={showLabels ? { fill: "var(--color-value)" } : false}
          isAnimationActive={false}
        >
          {showLabels && (
            <LabelList
              position="top"
              offset={12}
              fontSize={12}
              className="fill-neutral-900 dark:fill-neutral-100"
              formatter={(v) => (format ? format(Number(v)) : String(v))}
            />
          )}
        </Line>
      </LineChart>
    </ChartContainer>
  )
}

export type ListItem = {
  key: string
  date: string
  title: string
  detail?: string
  note?: string
  /** Makes the row tappable to edit or delete the saved entry. */
  edit?: EntryEdit
}

/** Entries grouped under date headings, newest first. Tap one to edit it. */
export function EntryList({
  items,
  empty,
  limit = 60,
}: {
  items: ListItem[]
  empty: string
  limit?: number
}) {
  const [editing, setEditing] = React.useState<EntryEdit | null>(null)
  const sorted = [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, limit)
  const groups: { date: string; items: ListItem[] }[] = []
  for (const item of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.date === item.date) last.items.push(item)
    else groups.push({ date: item.date, items: [item] })
  }

  return (
    <Panel title="Entries" subtitle={items.length > limit ? `Latest ${limit} of ${items.length}` : undefined}>
      {groups.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{empty}</p>
      ) : (
        <div className="-mx-5 -mb-2 flex flex-col">
          {groups.map((g) => (
            // A faint inset line between days.
            <div key={g.date} className="mx-5 border-t border-black/[0.07] first:border-t-0 dark:border-white/[0.08]">
              <p className="-mx-5 px-5 pt-3 pb-1 text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                {keyToDate(g.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
              <ul className="-mx-5">
                {g.items.map((item) => {
                  const row = (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] text-neutral-900 dark:text-neutral-100">{item.title}</p>
                        {item.note && (
                          <p className="line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">{item.note}</p>
                        )}
                      </div>
                      {item.detail && (
                        <span className="shrink-0 text-sm tabular-nums text-neutral-500 dark:text-neutral-400">
                          {item.detail}
                        </span>
                      )}
                    </>
                  )
                  const rowClass = "-mx-5 flex min-h-12 w-[calc(100%+2.5rem)] items-start gap-3 px-5 py-3 text-left"
                  return (
                    // No line inside a day; the line between days is on the group.
                    <li key={item.key} className="mx-5">
                      {item.edit ? (
                        <button
                          type="button"
                          onClick={() => setEditing(item.edit!)}
                          className={cn(rowClass, "cursor-pointer active:bg-neutral-50 dark:active:bg-neutral-800")}
                        >
                          {row}
                        </button>
                      ) : (
                        <div className={rowClass}>{row}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      <EntryEditor target={editing} onClose={() => setEditing(null)} />
    </Panel>
  )
}

/* ------------------------------------------------- Line over time buckets */

/** One point per day/week/month; gaps (NaN) are skipped, not drawn as 0. */
export function BucketLine({
  buckets,
  values,
  color,
  format,
  goal,
  goalLabel,
}: {
  buckets: Bucket[]
  values: number[]
  color: string
  format?: (v: number) => string
  goal?: number
  goalLabel?: string
}) {
  const config = { value: { label: "Value", color } } satisfies ChartConfig
  const data = buckets.map((b, i) => ({
    label: b.label,
    value: Number.isFinite(values[i]) ? Math.round(values[i] * 100) / 100 : null,
  }))
  const points = data.filter((d) => d.value !== null).length
  // Dates tilt 45° so they never collide; with lots of them, show about one in four.
  const angled = buckets.length > 4
  const interval = buckets.length > 14 ? Math.ceil(buckets.length / 8) - 1 : 0
  return (
    <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
      <LineChart data={data} margin={{ top: 16, left: 0, right: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={interval} height={angled ? 46 : 30} padding={{ left: 8, right: 8 }} tick={angled ? <AngledXTick /> : <EdgeXTick />} />
        <YAxis
          width={30}
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          tick={<LeftYTick format={format} />}
          domain={["dataMin - 1", "dataMax + 1"]}
          allowDecimals={false}
        />
        {goal !== undefined && (
          <ReferenceLine
            y={goal}
            strokeDasharray="4 4"
            className="stroke-neutral-400 dark:stroke-neutral-500"
            label={goalLabel ? { value: goalLabel, position: "insideTopRight", fontSize: 11, className: "fill-neutral-500" } : undefined}
          />
        )}
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2}
          connectNulls
          dot={points <= 31 ? { r: 3, fill: "var(--color-value)" } : false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

/* -------------------------------------------- Stacked half-ring (money) */

/**
 * shadcn "Radial Chart - Stacked": spent + left make up what came in.
 * The middle shows what's left (negative when spending passed income).
 */
export function IncomeRadial({
  income,
  spent,
  format,
}: {
  income: number
  spent: number
  format: (v: number) => string
}) {
  const left = income - spent
  const config = {
    spent: { label: "Spent", color: "#EE6C4D" },
    left: { label: "Left", color: "#2FA36B" },
  } satisfies ChartConfig
  // Over budget: the whole arc is spending.
  const data = [{ spent: Math.max(spent, 0.0001), left: Math.max(left, 0) }]
  // The half-ring is the whole of what came in (or what went out, if more).
  const total = Math.max(income, spent, 1)
  return (
    <div className="flex flex-col items-center">
      <ChartContainer config={config} className="mx-auto aspect-[2/1] h-[150px] w-full max-w-[300px]">
        <RadialBarChart data={data} endAngle={180} innerRadius={90} outerRadius={130} cy="100%">
          <PolarAngleAxis type="number" domain={[0, total]} tick={false} axisLine={false} />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) - 22}
                        className={cn("text-3xl font-bold", left < 0 ? "fill-red-600 dark:fill-red-400" : "fill-neutral-900 dark:fill-neutral-100")}
                      >
                        {left < 0 ? `−${format(Math.abs(left))}` : format(left)}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 2} className="fill-neutral-500 text-sm dark:fill-neutral-400">
                        {left < 0 ? "Over" : "Left"}
                      </tspan>
                    </text>
                  )
                }
              }}
            />
          </PolarRadiusAxis>
          <RadialBar dataKey="spent" stackId="a" cornerRadius={6} fill="var(--color-spent)" className="stroke-transparent stroke-2" isAnimationActive={false} />
          <RadialBar dataKey="left" stackId="a" cornerRadius={6} fill="var(--color-left)" className="stroke-transparent stroke-2" isAnimationActive={false} />
        </RadialBarChart>
      </ChartContainer>
      <div className="mt-3 flex gap-5 text-sm text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-[#2FA36B]" />Made {format(income)}</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-[#EE6C4D]" />Spent {format(spent)}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------- Day squares (calendar view) */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]

/**
 * A little square for every day of each month; days in `active` are filled.
 * Days outside the selected range are faded so the window is clear.
 */
export function DayGrid({
  months,
  active,
  color,
  start,
  end,
}: {
  months: Month[]
  active: Set<string>
  color: string
  start: string
  end: string
}) {
  // 1 month: one calendar, not too wide. 2–4: two across. A year: three across, tiny.
  const compact = months.length > 4
  return (
    <div
      className={cn(
        "grid gap-x-5 gap-y-5",
        compact ? "grid-cols-3" : months.length === 1 ? "grid-cols-1" : "grid-cols-2"
      )}
    >
      {months.map((m) => {
        const first = new Date(m.year, m.month, 1, 12)
        const count = new Date(m.year, m.month + 1, 0, 12).getDate()
        const cells: (string | null)[] = [
          ...Array.from({ length: first.getDay() }, () => null),
          ...Array.from({ length: count }, (_, i) => dateKey(new Date(m.year, m.month, i + 1, 12))),
        ]
        const done = cells.filter((k) => k && active.has(k)).length
        return (
          <div key={`${m.year}-${m.month}`} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className={cn("text-neutral-900 dark:text-neutral-100", compact ? "text-xs" : "text-sm font-medium")}>{m.label}</span>
              {!compact && <span className="text-xs whitespace-nowrap text-neutral-500 dark:text-neutral-400">{done} day{done === 1 ? "" : "s"}</span>}
            </div>
            <div className={cn("grid grid-cols-7", compact ? "gap-[3px]" : "gap-1")}>
              {!compact && WEEKDAYS.map((d, i) => (
                <span key={i} className="text-center text-[10px] text-neutral-400 dark:text-neutral-500">{d}</span>
              ))}
              {cells.map((key, i) => {
                if (!key) return <span key={`b${i}`} />
                const on = active.has(key)
                const inside = inRange(key, start, end)
                return (
                  <span
                    key={key}
                    title={`${keyToDate(key).toLocaleDateString("en-US", { month: "short", day: "numeric" })}${on ? " ✓" : ""}`}
                    className={cn(
                      // Thin gray outline on every square, filled or not.
                      "aspect-square ring-1 ring-black/15 ring-inset dark:ring-white/15",
                      compact ? "rounded-[2px]" : "rounded-[4px]",
                      !on && "bg-black/[0.04] dark:bg-white/[0.05]",
                      !inside && "opacity-35"
                    )}
                    style={on ? { backgroundColor: color } : undefined}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------- Concentric rings (macros) */

/**
 * One slim bar per nutrient, filled to its share of the daily goal, with
 * the actual number over the goal above it.
 */
export function GoalRings({
  rows,
}: {
  rows: { key: string; label: string; color: string; value: number; goal: number; unit: string }[]
}) {
  if (!rows.length) return null
  const share = (r: (typeof rows)[number]) => (r.goal > 0 && Number.isFinite(r.value) ? Math.min(r.value / r.goal, 1) : 0)
  const num = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString() : "—")

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-neutral-700 dark:text-neutral-300">{r.label}</span>
              <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{num(r.value)}</span>/{num(r.goal)}
                {r.unit}
              </span>
            </div>
            <span className="h-1.5 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10">
              <span className="block h-full rounded-full" style={{ width: `${share(r) * 100}%`, backgroundColor: r.color }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
