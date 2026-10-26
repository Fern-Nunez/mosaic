"use client"

import * as React from "react"

import { PAGE_TITLE } from "@/lib/app/ui"

// Ticks once a minute so the greeting flips at noon / 5pm on its own.
function subscribe(callback: () => void) {
  const id = window.setInterval(callback, 60_000)
  return () => window.clearInterval(id)
}
const getMinute = () => Math.floor(Date.now() / 60_000)
const getServerMinute = () => null

function greetingFor(hour: number) {
  if (hour < 12) return "Good Morning"
  if (hour < 17) return "Good Afternoon"
  return "Good Evening"
}

/**
 * Date + greeting. Rendered on the client so it uses the phone's own time
 * zone, not the server's.
 */
export function TodayHeader({ name }: { name: string | null }) {
  const minute = React.useSyncExternalStore(subscribe, getMinute, getServerMinute)
  const now = minute === null ? null : new Date(minute * 60_000)

  return (
    <header className="flex flex-col gap-2">
      <p className="h-5 text-sm text-neutral-500 dark:text-neutral-400">
        {now?.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      <h1 className={`min-h-[1.9em] ${PAGE_TITLE}`}>
        {now && (
          <>
            {greetingFor(now.getHours())}
            {name ? `, ${name}.` : "."}
          </>
        )}
      </h1>
    </header>
  )
}
