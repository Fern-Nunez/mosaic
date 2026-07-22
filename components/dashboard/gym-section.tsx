"use client"

import * as React from "react"
import { Dumbbell, Loader2, Plus, Trophy } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { createClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/components/dashboard/workspace-context"
import { dailyGymVolume, recentPRs, todayKey } from "@/lib/stats"
import type { GymRow } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
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
import { Checkbox } from "@/components/ui/checkbox"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

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
  rows: initialRows,
  userId,
}: {
  rows: GymRow[]
  userId: string
}) {
  const [rows, setRows] = React.useState<GymRow[]>(initialRows)

  const volume = React.useMemo(() => dailyGymVolume(rows), [rows])
  const prs = React.useMemo(() => recentPRs(rows), [rows])
  const recent = React.useMemo(() => rows.slice(0, 10), [rows])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Gym</h2>
          <p className="text-sm text-muted-foreground">
            Log your lifts and track your volume.
          </p>
        </div>
        <LogLiftDialog
          userId={userId}
          onLogged={(row) =>
            setRows((prev) =>
              [row, ...prev].sort((a, b) => b.date.localeCompare(a.date))
            )
          }
        />
      </div>

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
                  <li
                    key={pr.id}
                    className="flex items-start justify-between gap-2"
                  >
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
                      <TableCell className="whitespace-nowrap">
                        {g.date}
                      </TableCell>
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
    </div>
  )
}

type Draft = {
  date: string
  workout_name: string
  exercise: string
  sets: string
  reps: string
  weight: string
  unit: "lbs" | "kg" | "bodyweight"
  personal_record: boolean
  notes: string
}

function emptyDraft(): Draft {
  return {
    date: todayKey(),
    workout_name: "",
    exercise: "",
    sets: "",
    reps: "",
    weight: "",
    unit: "lbs",
    personal_record: false,
    notes: "",
  }
}

function LogLiftDialog({
  userId,
  onLogged,
}: {
  userId: string
  onLogged: (row: GymRow) => void
}) {
  const supabase = React.useMemo(() => createClient(), [])
  const { active } = useWorkspace()

  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<Draft>(emptyDraft)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function onOpenChange(next: boolean) {
    if (next) {
      setDraft(emptyDraft())
      setError(null)
    }
    setOpen(next)
  }

  // "" -> null; otherwise a positive number, or undefined on a bad value.
  function toNumber(raw: string, integer: boolean): number | null | undefined {
    if (raw.trim() === "") return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return undefined
    if (integer && !Number.isInteger(n)) return undefined
    return n
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const exercise = draft.exercise.trim()
    if (!exercise) {
      setError("Enter an exercise name.")
      return
    }

    const sets = toNumber(draft.sets, true)
    if (sets === undefined) {
      setError("Sets must be a whole number greater than 0.")
      return
    }
    const reps = toNumber(draft.reps, true)
    if (reps === undefined) {
      setError("Reps must be a whole number greater than 0.")
      return
    }
    const isBodyweight = draft.unit === "bodyweight"
    const weight = isBodyweight ? null : toNumber(draft.weight, false)
    if (weight === undefined) {
      setError("Weight must be a number greater than 0.")
      return
    }

    setBusy(true)
    const { data, error: err } = await supabase
      .from("gym_weight")
      .insert({
        user_id: userId,
        workspace: active.id,
        date: draft.date,
        workout_name: draft.workout_name.trim() || null,
        exercise,
        sets,
        reps,
        weight,
        unit: draft.unit,
        personal_record: draft.personal_record,
        notes: draft.notes.trim() || null,
      })
      .select(
        "id, date, workout_name, exercise, sets, reps, weight, unit, personal_record, notes"
      )
      .single()
    setBusy(false)

    if (err || !data) {
      setError(err?.message ?? "Couldn't save your lift.")
      return
    }

    onLogged(data as GymRow)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button className="shrink-0 bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm hover:from-indigo-600 hover:to-violet-700">
            <Plus className="size-4" />
            Log lift
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Dumbbell className="size-4.5" />
            </span>
            Log a lift
          </DialogTitle>
          <DialogDescription>
            Exercise is required. Everything else is optional.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lift-date">Date</Label>
              <Input
                id="lift-date"
                type="date"
                max={todayKey()}
                value={draft.date}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lift-workout">Workout</Label>
              <Input
                id="lift-workout"
                placeholder="e.g. Push day"
                value={draft.workout_name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, workout_name: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lift-exercise">Exercise</Label>
            <Input
              id="lift-exercise"
              placeholder="e.g. Bench press"
              autoFocus
              value={draft.exercise}
              onChange={(e) =>
                setDraft((d) => ({ ...d, exercise: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lift-sets">Sets</Label>
              <Input
                id="lift-sets"
                type="number"
                inputMode="numeric"
                step="1"
                min={0}
                placeholder="0"
                value={draft.sets}
                onChange={(e) => setDraft((d) => ({ ...d, sets: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lift-reps">Reps</Label>
              <Input
                id="lift-reps"
                type="number"
                inputMode="numeric"
                step="1"
                min={0}
                placeholder="0"
                value={draft.reps}
                onChange={(e) => setDraft((d) => ({ ...d, reps: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lift-weight">Weight</Label>
              <Input
                id="lift-weight"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                placeholder="0"
                disabled={draft.unit === "bodyweight"}
                value={draft.unit === "bodyweight" ? "" : draft.weight}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, weight: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lift-unit">Unit</Label>
              <Select
                value={draft.unit}
                onValueChange={(value) => {
                  if (value)
                    setDraft((d) => ({ ...d, unit: value as Draft["unit"] }))
                }}
              >
                <SelectTrigger id="lift-unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lbs">lbs</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="bodyweight">bodyweight</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lift-notes">Notes</Label>
            <Textarea
              id="lift-notes"
              rows={2}
              placeholder="Optional"
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.personal_record}
              onCheckedChange={(checked) =>
                setDraft((d) => ({ ...d, personal_record: checked === true }))
              }
            />
            Mark as a personal record
          </label>

          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save lift"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
