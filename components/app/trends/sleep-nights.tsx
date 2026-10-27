"use client"

import { keyToDate, shiftKey } from "@/lib/app/dates"
import { hoursLabel } from "@/lib/app/metrics"
import { cn } from "@/lib/utils"

const COLOR = "#8A7BB8"
const NIGHTS = 5

/**
 * Last 5 nights as little bars against a dashed goal line, for the Sleep
 * card on Trends. Full bars hit the goal; faded ones fell short. A dashed
 * outline means nothing was logged that night.
 */
export function SleepNights({
  sleep,
  goal,
  today,
}: {
  sleep: { date: string; hours: number | null }[]
  goal: number
  today: string
}) {
  // A sleep entry dated D is the night before D, so today = last night.
  const nights = Array.from({ length: NIGHTS }, (_, i) => {
    const date = shiftKey(today, i - (NIGHTS - 1))
    const hours = sleep.find((s) => s.date === date)?.hours ?? null
    return { date, hours: hours == null ? null : Number(hours) }
  })
  const top = Math.max(goal + 1.5, ...nights.map((n) => n.hours ?? 0))
  const pct = (h: number) => `${Math.min(100, (h / top) * 100)}%`

  return (
    <div className="flex w-full flex-col gap-1" aria-label={`Last ${NIGHTS} nights against a ${goal} hour goal`}>
      <div className="relative h-12">
        <div className="absolute inset-x-0 border-t border-dashed border-neutral-400 dark:border-neutral-500" style={{ bottom: pct(goal) }} />
        <div className="flex h-full items-end justify-between gap-1.5">
          {nights.map((n) => (
            <div key={n.date} className="flex h-full flex-1 items-end" title={n.hours == null ? "Not logged" : hoursLabel(n.hours)}>
              {n.hours == null ? (
                <div className="h-1.5 w-full rounded-[3px] border border-dashed border-neutral-400/70 dark:border-neutral-600" />
              ) : (
                <div
                  className={cn("w-full rounded-[3px]", n.hours < goal && "opacity-45")}
                  style={{ height: pct(n.hours), backgroundColor: COLOR }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between gap-1.5">
        {nights.map((n) => (
          <span key={n.date} className="flex-1 text-center text-[10px] leading-none text-neutral-500 dark:text-neutral-400">
            {keyToDate(n.date).toLocaleDateString("en-US", { weekday: "narrow" })}
          </span>
        ))}
      </div>
    </div>
  )
}
