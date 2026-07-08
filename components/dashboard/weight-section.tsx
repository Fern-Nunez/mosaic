"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import type { WeightPoint } from "@/lib/stats"
import type { WeightRow } from "@/lib/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const weightConfig = {
  weight: { label: "Weight", color: "var(--chart-2)" },
} satisfies ChartConfig

function Measurement({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function WeightSection({
  series,
  latest,
}: {
  series: WeightPoint[]
  latest: WeightRow | null
}) {
  const unit = latest?.unit && latest.unit !== "unknown" ? latest.unit : ""

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Body weight</CardTitle>
          <CardDescription>All logged weigh-ins</CardDescription>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No weigh-ins logged yet.
            </p>
          ) : (
            <ChartContainer config={weightConfig} className="h-64 w-full">
              <LineChart accessibilityLayer data={series}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={45}
                  domain={["auto", "auto"]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="weight"
                  type="monotone"
                  stroke="var(--color-weight)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest measurements</CardTitle>
          <CardDescription>
            {latest ? `Logged ${latest.date}` : "Nothing logged yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {latest ? (
            <div className="grid grid-cols-2 gap-3">
              {latest.weight != null && (
                <Measurement
                  label="Weight"
                  value={`${Number(latest.weight)} ${unit}`.trim()}
                />
              )}
              {latest.body_fat != null && (
                <Measurement
                  label="Body fat"
                  value={`${Number(latest.body_fat)}%`}
                />
              )}
              {latest.waist != null && (
                <Measurement label="Waist" value={`${Number(latest.waist)}"`} />
              )}
              {latest.chest != null && (
                <Measurement label="Chest" value={`${Number(latest.chest)}"`} />
              )}
              {latest.arms != null && (
                <Measurement label="Arms" value={`${Number(latest.arms)}"`} />
              )}
              {latest.legs != null && (
                <Measurement label="Legs" value={`${Number(latest.legs)}"`} />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Log a weigh-in to see it here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
