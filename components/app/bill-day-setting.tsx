"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarClock } from "lucide-react"

import { usePrefs } from "@/components/app/prefs-context"
import { Reveal } from "@/components/app/reveal"
import { Switch } from "@/components/ui/switch"
import { savePrefs } from "@/lib/app/save-prefs"
import { cn } from "@/lib/utils"

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"
  return `${n}${s}`
}

/**
 * More → Bill reminder: one day of the month you pay everything. A switch,
 * and when it's on, the days 1–31 as a small calendar grid; one tap picks.
 * The daily reminder job sends a push that day (needs Notifications on).
 */
export function BillDaySetting() {
  const router = useRouter()
  const { prefs, userId } = usePrefs()
  const [day, setDay] = React.useState<number | null>(prefs.billPayDay ?? null)
  // The grid stays open while switched on with no day picked yet.
  const [picking, setPicking] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // Last picked day, so the note can still say it while it animates away.
  const [lastDay, setLastDay] = React.useState(day ?? 1)
  if (day !== null && day !== lastDay) setLastDay(day)

  async function save(next: number | null) {
    const prev = day
    setDay(next)
    setError(null)
    const err = await savePrefs(userId, { billPayDay: next })
    if (err) {
      setDay(prev)
      return setError(err)
    }
    router.refresh()
  }

  const on = day !== null || picking
  return (
    <div className="flex flex-col px-4 py-1.5">
      <div className="flex min-h-11 items-center gap-3 text-[15px] text-neutral-900 dark:text-neutral-100">
        <CalendarClock className="size-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
        <span className="flex-1">Bill reminder</span>
        {day !== null && (
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            className="cursor-pointer text-[15px] text-neutral-500 dark:text-neutral-400"
          >
            The {ordinal(day)}
          </button>
        )}
        <Switch
          checked={on}
          onCheckedChange={(v) => {
            if (v) setPicking(true)
            else {
              setPicking(false)
              if (day !== null) save(null)
            }
          }}
          className="data-checked:bg-[#318E63]"
        />
      </div>

      <Reveal open={picking}>
        <div className="grid grid-cols-7 gap-1.5 pt-1 pb-2 pl-8">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setPicking(false)
                save(n)
              }}
              aria-pressed={n === day}
              className={cn(
                "aspect-square cursor-pointer rounded-full border text-sm tabular-nums transition-colors",
                n === day
                  ? "border-black/15 bg-white font-medium text-neutral-900 shadow-sm dark:border-white/25 dark:bg-white/15 dark:text-white"
                  : "chip text-neutral-700 dark:text-neutral-300"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal open={day !== null && !picking}>
        <p className="pb-1.5 pl-8 text-xs text-neutral-500 dark:text-neutral-400">
          A push on the {ordinal(lastDay)} of every month{lastDay > 28 ? " (or the last day, in shorter months)" : ""}. Tap the day to change it.
        </p>
      </Reveal>
      {error && <p className="pb-1.5 pl-8 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
