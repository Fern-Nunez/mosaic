"use client"

import * as React from "react"
import { Loader2, Moon, Plus } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/components/dashboard/workspace-context"
import { todayKey } from "@/lib/stats"
import type { SleepRow } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

/**
 * Decimal hours are what the column stores and what the chart needs, but
 * nobody thinks in them — 7.33 is a worse way to say 7h 20m. Entry and
 * display are in hours and minutes; the decimal only exists in the database.
 */
function toDecimal(hours: string, minutes: string): number | null {
  const h = hours.trim() === "" ? 0 : Number(hours)
  const m = minutes.trim() === "" ? 0 : Number(minutes)
  if (hours.trim() === "" && minutes.trim() === "") return null
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  // numeric(4,2) in the table, so two places is all that survives anyway.
  return Math.round((h + m / 60) * 100) / 100
}

function formatDuration(decimal: number | null): string {
  if (decimal == null) return "—"
  const total = Math.round(decimal * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Sleep log: a score and a duration per night.
 *
 * Both are optional individually — plenty of nights you know you slept about
 * seven hours and have no score, or the tracker gives a score and you do not
 * care about the exact minutes. The row is rejected only if both are empty.
 */
export function SleepSection({
  rows,
  userId,
}: {
  rows: SleepRow[]
  userId: string
}) {
  const supabase = React.useMemo(() => createClient(), [])
  const workspace = useWorkspace()

  const [entries, setEntries] = React.useState<SleepRow[]>(rows)
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [date, setDate] = React.useState(todayKey())
  const [score, setScore] = React.useState("")
  const [hoursPart, setHoursPart] = React.useState("")
  const [minutesPart, setMinutesPart] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const recent = entries.slice(0, 14)
  const avgScore = average(
    recent.map((r) => r.score).filter((v): v is number => v != null)
  )
  const avgHours = average(
    recent.map((r) => r.hours).filter((v): v is number => v != null)
  )

  const save = async () => {
    const scoreValue = score.trim() === "" ? null : Number(score)
    const hoursValue = toDecimal(hoursPart, minutesPart)

    if (scoreValue == null && hoursValue == null) {
      setError("Add a score, hours, or both.")
      return
    }
    if (scoreValue != null && (scoreValue < 0 || scoreValue > 100)) {
      setError("Score runs 0 to 100.")
      return
    }
    if (minutesPart.trim() !== "" && Number(minutesPart) > 59) {
      setError("Minutes go up to 59 — use the hours box for the rest.")
      return
    }
    if (hoursValue != null && (hoursValue < 0 || hoursValue > 24)) {
      setError("That is more than a day.")
      return
    }

    setSaving(true)
    setError(null)

    const { data, error: dbError } = await supabase
      .from("sleep")
      .upsert(
        {
          user_id: userId,
          workspace,
          date,
          score: scoreValue,
          hours: hoursValue,
          notes: notes.trim() || null,
        },
        // One entry per night: logging the same date again edits it.
        { onConflict: "user_id,workspace,date" }
      )
      .select("id, date, score, hours, bedtime, wake_time, notes")
      .single()

    setSaving(false)

    if (dbError) {
      setError(dbError.message)
      return
    }

    const row = data as SleepRow
    setEntries((cur) =>
      [row, ...cur.filter((r) => r.date !== row.date)].sort((a, b) =>
        a.date < b.date ? 1 : -1
      )
    )
    setScore("")
    setHoursPart("")
    setMinutesPart("")
    setNotes("")
    setOpen(false)
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average score</CardDescription>
            <CardTitle className="text-3xl">
              {avgScore == null ? "—" : Math.round(avgScore)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Last {recent.length} {recent.length === 1 ? "night" : "nights"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average slept</CardDescription>
            <CardTitle className="text-3xl">
              {formatDuration(avgHours)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Last {recent.length} {recent.length === 1 ? "night" : "nights"}
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Moon className="size-4" />
              Sleep log
            </CardTitle>
            <CardDescription>One entry per night.</CardDescription>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button size="sm" className="shrink-0">
                  <Plus className="size-4" />
                  Log sleep
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log sleep</DialogTitle>
                <DialogDescription>
                  Score, hours, or both — whichever you have.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sleep-date">Night of</Label>
                  <Input
                    id="sleep-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="sleep-score">Score</Label>
                    <Input
                      id="sleep-score"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      placeholder="82"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sleep-hours">Slept</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        id="sleep-hours"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={24}
                        placeholder="7"
                        value={hoursPart}
                        onChange={(e) => setHoursPart(e.target.value)}
                        aria-label="Hours slept"
                      />
                      <span className="text-sm text-muted-foreground">h</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={59}
                        step={5}
                        placeholder="30"
                        value={minutesPart}
                        onChange={(e) => setMinutesPart(e.target.value)}
                        aria-label="Minutes slept"
                      />
                      <span className="text-sm text-muted-foreground">m</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sleep-notes">Notes</Label>
                  <Input
                    id="sleep-notes"
                    placeholder="Woke up twice"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
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
        </CardHeader>

        <CardContent>
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing logged yet. A couple of weeks of nights is enough to start
              comparing sleep against everything else.
            </p>
          ) : (
            <ul className="divide-y">
              {entries.slice(0, 30).map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <span className="text-muted-foreground">
                    {new Date(row.date).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-4 tabular-nums">
                    <span>{row.score == null ? "—" : row.score}</span>
                    <span className="text-muted-foreground">
                      {formatDuration(row.hours)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
