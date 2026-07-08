"use client"

import { Trophy } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { DailyVolume } from "@/lib/stats"
import type { GymRow } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const volumeConfig = {
  volume: { label: "Volume", color: "var(--chart-2)" },
} satisfies ChartConfig

function formatLift(row: GymRow): string {
  const parts: string[] = []
  if (row.sets && row.reps) parts.push(`${row.sets}×${row.reps}`)
  if (row.weight != null && row.unit !== "bodyweight") {
    parts.push(`${Number(row.weight)} ${row.unit ?? ""}`.trim())
  } else if (row.unit === "bodyweight") {
    parts.push("bodyweight")
  }
  return parts.join(" @ ") || "—"
}

export function GymSection({
  volume,
  prs,
  recent,
}: {
  volume: DailyVolume[]
  prs: GymRow[]
  recent: GymRow[]
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Training volume</CardTitle>
          <CardDescription>
            Sets × reps × weight, last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={volumeConfig} className="h-64 w-full">
            <AreaChart accessibilityLayer data={volume}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis tickLine={false} axisLine={false} width={50} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="volume"
                type="monotone"
                fill="var(--color-volume)"
                fillOpacity={0.2}
                stroke="var(--color-volume)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4" /> Personal records
          </CardTitle>
          <CardDescription>Most recent PRs</CardDescription>
        </CardHeader>
        <CardContent>
          {prs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No PRs yet — go get one.
            </p>
          ) : (
            <ul className="space-y-3">
              {prs.map((pr) => (
                <li key={pr.id} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{pr.exercise}</p>
                    <p className="text-xs text-muted-foreground">{pr.date}</p>
                  </div>
                  <Badge>{formatLift(pr)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Recent lifts</CardTitle>
          <CardDescription>Your latest 10 entries</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workouts logged yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Workout</TableHead>
                  <TableHead>Exercise</TableHead>
                  <TableHead className="text-right">Sets × Reps</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="whitespace-nowrap">{g.date}</TableCell>
                    <TableCell className="max-w-40 truncate">
                      {g.workout_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {g.exercise}
                      {g.personal_record && (
                        <Badge className="ml-2" variant="secondary">
                          PR
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {g.sets && g.reps ? `${g.sets} × ${g.reps}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {g.unit === "bodyweight"
                        ? "BW"
                        : g.weight != null
                          ? `${Number(g.weight)} ${g.unit ?? ""}`
                          : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
