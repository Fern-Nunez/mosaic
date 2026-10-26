"use client"

import * as React from "react"

import { dateKey } from "@/lib/app/dates"

// The phone's own "today" (the server may be in another time zone).
// Re-checked every minute so it rolls over at midnight.
function subscribe(callback: () => void) {
  const id = window.setInterval(callback, 60_000)
  return () => window.clearInterval(id)
}
const getToday = () => dateKey(new Date())
const getServerToday = () => null

/** Today's date key on this device, or null during the server render. */
export function useToday(): string | null {
  return React.useSyncExternalStore(subscribe, getToday, getServerToday)
}
