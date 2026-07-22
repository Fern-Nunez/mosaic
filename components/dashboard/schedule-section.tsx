"use client"

import { CalendarDays } from "lucide-react"

import { useHabits } from "@/components/dashboard/habits-context"
import { Card, CardContent } from "@/components/ui/card"
import type { Calendar } from "@/lib/habits"

// Google's embed shows several calendars at once by repeating the `src`
// param, so merge every saved calendar's src values into one URL.
function combineCalendarUrls(calendars: Calendar[]): string | null {
  const srcs = new Set<string>()
  let base: URL | null = null
  for (const calendar of calendars) {
    let url: URL
    try {
      url = new URL(calendar.url)
    } catch {
      continue
    }
    if (url.hostname !== "calendar.google.com") continue
    if (!base) base = url
    url.searchParams.getAll("src").forEach((src) => srcs.add(src))
  }
  if (!base || srcs.size === 0) return null

  const params = new URLSearchParams()
  base.searchParams.forEach((value, key) => {
    if (key !== "src") params.append(key, value)
  })
  srcs.forEach((src) => params.append("src", src))
  return `https://calendar.google.com/calendar/embed?${params.toString()}`
}

// The embedded calendar shown on the overview. Managed from Settings.
export function ScheduleSection() {
  const { calendars } = useHabits()
  const combined = combineCalendarUrls(calendars)

  if (!combined) {
    return (
      <Card className="flex h-full items-center justify-center">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <CalendarDays className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Add a Google Calendar in Settings to see your schedule here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <iframe
      title="Google Calendar"
      src={combined}
      className="h-full w-full rounded-lg border bg-background"
    />
  )
}
