"use client"

import * as React from "react"
import { Check, ChevronLeft, ChevronRight, Flame } from "lucide-react"

import { useWorkspace } from "@/components/dashboard/workspace-context"
import { useLocalStorageItem } from "@/hooks/use-local-storage"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function toKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function currentStreak(checked: Set<string>): number {
  const cursor = new Date()
  // A streak survives until today is over, so an unchecked today
  // doesn't break it — start counting from yesterday in that case.
  if (!checked.has(toKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  let streak = 0
  while (checked.has(toKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function CheckinCalendar() {
  const { active } = useWorkspace()
  const storageKey = `mosaic:${active.id}:checkins`

  const [month, setMonth] = React.useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const checkedRaw = useLocalStorageItem(storageKey)
  const checked = React.useMemo<Set<string>>(() => {
    if (!checkedRaw) return new Set()
    try {
      return new Set(JSON.parse(checkedRaw) as string[])
    } catch {
      return new Set()
    }
  }, [checkedRaw])

  const today = new Date()
  const todayKey = toKey(today)
  const monthLabel = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate()
  const leadingBlanks = month.getDay()
  const weekRows = Math.ceil((leadingBlanks + daysInMonth) / 7)
  const checkedThisMonth = Array.from(
    { length: daysInMonth },
    (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)
  ).filter((date) => checked.has(toKey(date))).length
  const streak = currentStreak(checked)

  return (
    <Card className="flex w-full flex-1 flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Daily check-ins</CardTitle>
            <CardDescription>
              Finish every habit in the top bar and the day lights up green.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() =>
                setMonth(
                  (prev) =>
                    new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                )
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-28 text-center text-sm font-medium tabular-nums">
              {monthLabel}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next month"
              onClick={() =>
                setMonth(
                  (prev) =>
                    new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                )
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              className="py-1 text-xs font-medium text-muted-foreground"
            >
              {day}
            </span>
          ))}
        </div>
        <div
          className="grid flex-1 grid-cols-7 gap-1 text-center"
          style={{ gridTemplateRows: `repeat(${weekRows}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = new Date(month.getFullYear(), month.getMonth(), i + 1)
            const key = toKey(date)
            const isChecked = checked.has(key)
            const isToday = key === todayKey
            const isFuture = key > todayKey
            return (
              <div
                key={key}
                aria-label={`${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}${isChecked ? " — done" : ""}`}
                className={cn(
                  "relative flex min-h-9 flex-col rounded-lg border p-2 text-sm tabular-nums transition-colors",
                  isChecked
                    ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/60 ring-inset"
                    : "border-input bg-background",
                  isToday && !isChecked && "border-emerald-500/60 ring-1 ring-emerald-500/40",
                  isFuture && "border-dashed text-muted-foreground/40"
                )}
              >
                <span
                  className={cn(
                    "leading-none",
                    isChecked && "font-semibold text-emerald-700 dark:text-emerald-400",
                    isToday && !isChecked && "font-semibold text-foreground"
                  )}
                >
                  {i + 1}
                </span>
                {isChecked && (
                  <span className="mt-auto flex size-6 items-center justify-center self-end rounded-full bg-emerald-500 text-white shadow-[0_0_8px_1px] shadow-emerald-500/50">
                    <Check className="size-3.5" />
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {checkedThisMonth} {checkedThisMonth === 1 ? "day" : "days"} this
            month
          </span>
          {streak > 0 && (
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Flame className="size-3.5 text-orange-500" />
              {streak}-day streak
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
