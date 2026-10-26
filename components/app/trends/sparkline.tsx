"use client"

import { Area, AreaChart, YAxis } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

/** Rolling average, so daily ups and downs read as a trend at this size. */
function smooth(values: number[], window: number) {
  return values.map((v, i) => {
    if (Number.isNaN(v)) return null
    if (window <= 1) return v
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((x) => !Number.isNaN(x))
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

/** Tiny trend line for a Trends card. No axes, no labels. */
export function Sparkline({
  values,
  color,
  smoothing = 1,
}: {
  values: number[]
  color: string
  /** Days to average over (1 = raw). */
  smoothing?: number
}) {
  const config = { v: { label: "Value", color } } satisfies ChartConfig
  const data = smooth(values, smoothing).map((v, i) => ({ i, v }))
  if (data.filter((d) => d.v !== null).length < 2) return <div className="h-12" />
  const id = `spark-${color.replace("#", "")}`
  return (
    <ChartContainer config={config} className="aspect-auto h-12 w-full">
      <AreaChart data={data} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-v)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-v)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          dataKey="v"
          type="monotone"
          stroke="var(--color-v)"
          strokeWidth={2}
          fill={`url(#${id})`}
          connectNulls
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
