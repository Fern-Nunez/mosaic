"use client"

import * as React from "react"
import { Loader2, Plus } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { createClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/components/dashboard/workspace-context"
import { toDateKey, todayKey } from "@/lib/stats"
import type { RunRow } from "@/lib/types"
import { Button } from "@/components/ui/button"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const WEEKS = 12

const mileageConfig = {
  miles: { label: "Miles", color: "var(--chart-2)" },
} satisfies ChartConfig

/** "1:02:05" or "25:40" for a number of seconds. */
export function formatDuration(seconds: number): string {
  // Round first so 8:59.6 becomes 9:00, not 8:60.
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m)
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`
}

/** "8:32 /mi" for seconds per mile. */
export function formatPace(secondsPerMile: number): string {
  return `${formatDuration(secondsPerMile)} /mi`
}

/** Miles per week, Monday-start, oldest first, ending with this week. */
function weeklyMileage(rows: RunRow[]) {
  const monday = new Date()
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))

  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(monday)
    start.setDate(monday.getDate() - (WEEKS - 1 - i) * 7)
    return {
      key: toDateKey(start),
      label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      miles: 0,
    }
  })

  for (const r of rows) {
    if (r.date < weeks[0].key) continue
    // The latest week whose Monday is on or before the run.
    const week = weeks.findLast((w) => r.date >= w.key)
    if (week) week.miles += Number(r.distance_miles)
  }
  return weeks.map((w) => ({ ...w, miles: Math.round(w.miles * 10) / 10 }))
}

export function RunningSection({
  rows: initialRows,
  userId,
}: {
  rows: RunRow[]
  userId: string
}) {
  const [rows, setRows] = React.useState<RunRow[]>(initialRows)
  const weeks = React.useMemo(() => weeklyMileage(rows), [rows])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <LogRunDialog
          userId={userId}
          onLogged={(row) =>
            setRows((prev) =>
              [row, ...prev].sort((a, b) => b.date.localeCompare(a.date))
            )
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly mileage</CardTitle>
          <CardDescription>Last {WEEKS} weeks</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={mileageConfig} className="aspect-auto h-64 w-full">
            <BarChart accessibilityLayer data={weeks}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent labelFormatter={(l) => `Week of ${l}`} />}
              />
              <Bar dataKey="miles" fill="var(--color-miles)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
          <CardDescription>
            {rows.length === 0
              ? "Nothing logged yet."
              : `${rows.length} ${rows.length === 1 ? "run" : "runs"} logged`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Log a run to start your mileage chart.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    <TableHead className="text-right">Pace</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const miles = Number(r.distance_miles)
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {new Date(`${r.date}T00:00`).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {miles} mi
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDuration(r.duration_seconds)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPace(r.duration_seconds / miles)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LogRunDialog({
  userId,
  onLogged,
}: {
  userId: string
  onLogged: (row: RunRow) => void
}) {
  const supabase = React.useMemo(() => createClient(), [])
  const { active } = useWorkspace()

  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [date, setDate] = React.useState(todayKey())
  const [distance, setDistance] = React.useState("")
  const [hours, setHours] = React.useState("")
  const [minutes, setMinutes] = React.useState("")
  const [seconds, setSeconds] = React.useState("")

  const miles = Number(distance)
  const duration =
    (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
  const pace = miles > 0 && duration > 0 ? duration / miles : null

  const save = async () => {
    if (!(miles > 0)) {
      setError("Add how far you ran.")
      return
    }
    if (!(duration > 0)) {
      setError("Add how long it took.")
      return
    }
    if (Number(minutes) > 59 || Number(seconds) > 59) {
      setError("Minutes and seconds go up to 59.")
      return
    }

    setSaving(true)
    setError(null)
    const { data, error: dbError } = await supabase
      .from("runs")
      .insert({
        user_id: userId,
        workspace: active.id,
        date,
        distance_miles: Math.round(miles * 100) / 100,
        duration_seconds: Math.round(duration),
      })
      .select("id, date, distance_miles, duration_seconds")
      .single()
    setSaving(false)

    if (dbError) {
      setError(dbError.message)
      return
    }
    onLogged(data as RunRow)
    setDistance("")
    setHours("")
    setMinutes("")
    setSeconds("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Log run
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log run</DialogTitle>
          <DialogDescription>Distance and time — pace works itself out.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="run-date">Date</Label>
              <Input
                id="run-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="run-distance">Distance (mi)</Label>
              <Input
                id="run-distance"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                placeholder="3.1"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="run-hours">Time</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="run-hours"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                aria-label="Hours"
              />
              <span className="text-sm text-muted-foreground">h</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                placeholder="25"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                aria-label="Minutes"
              />
              <span className="text-sm text-muted-foreground">m</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                placeholder="40"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                aria-label="Seconds"
              />
              <span className="text-sm text-muted-foreground">s</span>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {pace ? `Pace ${formatPace(pace)}` : "Pace shows once distance and time are in."}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
