"use client"

import * as React from "react"
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { EdgeXTick } from "@/components/app/chart-ticks"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { formatMetric, INSIGHT_METRICS, type InsightChart } from "@/lib/app/insight-metrics"
import { cn } from "@/lib/utils"

// First metric green, second terracotta: easy to tell apart, both on-brand.
const COLORS = ["#318E63", "#C8735F"]
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * A chart the Insights AI asked for. Tap (or use the arrows) to pick a day
 * or week; the card below shows everything logged then.
 */
export function InsightChartView({ chart }: { chart: InsightChart }) {
  const [selected, setSelected] = React.useState(chart.points.length - 1)
  const point = chart.points[selected]
  const config = Object.fromEntries(
    chart.metrics.map((id, i) => [id, { label: INSIGHT_METRICS[id].label, color: COLORS[i] }])
  ) satisfies ChartConfig
  const data = chart.points.map((p) => ({
    label: p.label,
    ...Object.fromEntries(chart.metrics.map((id) => [id, p.values[id] ?? null])),
  }))
  const perPoint = chart.span === 90 ? "week" : "day"
  const interval = data.length > 14 ? Math.ceil(data.length / 5) - 1 : data.length > 7 ? 1 : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Legend with the average for each, so the two scales still read. */}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {chart.metrics.map((id, i) => {
          const xs = chart.points.map((p) => p.values[id]).filter((v): v is number => v != null)
          const mean = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
          return (
            <span key={id} className="flex items-center gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
              <i className={cn("size-2.5", INSIGHT_METRICS[id].mark === "bar" ? "rounded-[3px]" : "rounded-full")} style={{ backgroundColor: COLORS[i] }} />
              {INSIGHT_METRICS[id].label}
              <span className="text-neutral-500 dark:text-neutral-400">
                {/* One more decimal for averages: 0.6 workouts/day, not "1". */}
                avg {formatMetric(id, mean, INSIGHT_METRICS[id].digits === 0 && mean !== null && mean < 10 ? 1 : 0)}/{perPoint}
              </span>
            </span>
          )
        })}
      </div>

      {/* Tapped column from the tap position: every point gets an equal slice
          of the width (no side margins), so this is exact and doesn't depend
          on the tooltip having caught up. */}
      <div
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const i = Math.floor(((e.clientX - box.left) / box.width) * data.length)
          setSelected(Math.min(data.length - 1, Math.max(0, i)))
        }}
      >
      <ChartContainer config={config} className="aspect-auto h-[190px] w-full">
        <ComposedChart data={data} margin={{ top: 8, left: 0, right: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={interval} tick={<EdgeXTick />} />
          {/* Each metric on its own hidden scale: sleep hours and workout counts don't share units. */}
          {chart.metrics.map((id, i) => (
            <YAxis
              key={id}
              yAxisId={id}
              hide
              orientation={i === 0 ? "left" : "right"}
              domain={INSIGHT_METRICS[id].mark === "bar" ? [0, "auto"] : ["auto", "auto"]}
            />
          ))}
          {/* Tooltip only drives the tap target and highlight; the card below shows the numbers. */}
          <ChartTooltip content={() => null} cursor={{ fill: "rgb(0 0 0 / 0.04)", stroke: "rgb(0 0 0 / 0.12)" }} />
          <ReferenceLine yAxisId={chart.metrics[0]} x={point?.label} strokeDasharray="4 4" className="stroke-neutral-400 dark:stroke-neutral-500" />
          {chart.metrics.map((id) =>
            INSIGHT_METRICS[id].mark === "bar" ? (
              <Bar key={id} yAxisId={id} dataKey={id} fill={`var(--color-${id})`} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            ) : (
              <Line
                key={id}
                yAxisId={id}
                dataKey={id}
                type="monotone"
                stroke={`var(--color-${id})`}
                strokeWidth={2}
                connectNulls
                dot={data.length <= 31 ? { r: 2.5, fill: `var(--color-${id})` } : false}
                isAnimationActive={false}
              />
            )
          )}
        </ComposedChart>
      </ChartContainer>
      </div>

      {point && (
        <div className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelected((s) => Math.max(0, s - 1))}
              disabled={selected === 0}
              aria-label="Previous"
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-neutral-600 disabled:opacity-30 active:bg-neutral-200 dark:text-neutral-300 dark:active:bg-neutral-700"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{point.title}</span>
            <button
              type="button"
              onClick={() => setSelected((s) => Math.min(chart.points.length - 1, s + 1))}
              disabled={selected === chart.points.length - 1}
              aria-label="Next"
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-neutral-600 disabled:opacity-30 active:bg-neutral-200 dark:text-neutral-300 dark:active:bg-neutral-700"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          {/* The charted two first, then everything else from that day. */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {[...chart.metrics, ...chart.detail.filter((id) => !chart.metrics.includes(id))].map((id) => {
              const charted = chart.metrics.indexOf(id)
              return (
                <div key={id} className="flex items-baseline justify-between gap-2">
                  <dt className="flex items-center gap-1.5 truncate text-neutral-500 dark:text-neutral-400">
                    {charted >= 0 && <i className="size-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[charted] }} />}
                    {INSIGHT_METRICS[id].label}
                  </dt>
                  <dd className="tabular-nums text-neutral-900 dark:text-neutral-100">
                    {id === "mood" && point.moods.length && chart.span !== 90
                      ? cap(point.moods[0])
                      : formatMetric(id, point.values[id])}
                  </dd>
                </div>
              )
            })}
          </dl>
          {point.workouts.length > 0 && (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {chart.span === 90 ? "Did: " : "Workout: "}
              {point.workouts.map(cap).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
