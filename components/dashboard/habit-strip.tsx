"use client"

import * as React from "react"
import { Flame } from "lucide-react"

import { useHabits } from "@/components/dashboard/habits-context"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { currentStreak, dateKey, fullyCompletedDays } from "@/lib/habits"

// Fewer, bigger squares on phones; the full run on wider screens. The
// mobile set is the most recent days (the right end), so the older days
// on the left are the ones dropped.
const DESKTOP_DAYS = 42
const MOBILE_DAYS = 21
const MOBILE_HIDDEN = DESKTOP_DAYS - MOBILE_DAYS

export function HabitStrip() {
  const { habits, completions } = useHabits()

  const completed = React.useMemo(
    () => fullyCompletedDays(habits, completions),
    [habits, completions]
  )

  const todayKey = dateKey(new Date())
  const days = React.useMemo(() => {
    const out: { key: string; done: boolean; isToday: boolean }[] = []
    for (let i = DESKTOP_DAYS - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = dateKey(date)
      out.push({ key, done: completed.has(key), isToday: key === todayKey })
    }
    return out
  }, [completed, todayKey])

  const streak = currentStreak(completed)

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-6 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Daily habits</p>
          <div className="mt-2 grid gap-1 grid-cols-[repeat(21,minmax(0,1fr))] sm:grid-cols-[repeat(42,minmax(0,1fr))]">
            {days.map((day, index) => (
              <div
                key={day.key}
                title={`${day.key} — ${day.done ? "all habits done" : "not completed"}`}
                className={cn(
                  "aspect-square rounded-sm border transition-colors",
                  day.done
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-rose-400/60 bg-rose-500/15",
                  day.isToday &&
                    "ring-1 ring-ring/60 ring-offset-1 ring-offset-background",
                  index < MOBILE_HIDDEN && "hidden sm:block"
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end">
          <span className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
            <Flame
              className={cn(
                "size-5",
                streak > 0 ? "text-orange-500" : "text-muted-foreground/40"
              )}
            />
            {streak}
          </span>
          <span className="text-xs text-muted-foreground">
            day{streak === 1 ? "" : "s"} streak
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
