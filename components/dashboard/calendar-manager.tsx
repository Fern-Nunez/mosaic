"use client"

import * as React from "react"
import { CalendarDays, Plus, Trash2 } from "lucide-react"

import { useHabits } from "@/components/dashboard/habits-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// The add/list UI for embedded Google Calendars — lives in Settings. Each
// calendar gets a name so the list is readable instead of raw calendar ids.
export function CalendarManager() {
  const { calendars, addCalendar, removeCalendar } = useHabits()

  const [name, setName] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = addCalendar(name, url)
    if (result) {
      setError(result)
      return
    }
    setName("")
    setUrl("")
    setError(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-medium">Google Calendar</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Add one or more calendars and they&apos;ll show together on your
        overview. In Google Calendar → Settings → Integrate calendar, copy the
        Embed code and paste it below.
      </p>

      {calendars.length > 0 && (
        <div className="space-y-2">
          {calendars.map((calendar, index) => (
            <div
              key={`${calendar.url}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <span className="flex items-center gap-2 truncate text-sm">
                <span className="size-2.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate font-medium">{calendar.name}</span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${calendar.name}`}
                onClick={() => removeCalendar(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-2">
        <div className="space-y-1.5">
          <Label htmlFor="calendar-name">Name</Label>
          <Input
            id="calendar-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            placeholder="e.g. Work, Personal, Gym"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calendar-url">Embed code or URL</Label>
          <div className="flex items-center gap-2">
            <Input
              id="calendar-url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                setError(null)
              }}
              placeholder='<iframe src="https://calendar.google.com/calendar/embed?...">'
            />
            <Button type="submit" disabled={!url.trim()}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      <p className="text-xs text-muted-foreground">
        Only calendar.google.com links are accepted. Private calendars show
        while you&apos;re signed in to that Google account in this browser —
        otherwise make the calendar public or use its secret address.
      </p>
    </div>
  )
}
