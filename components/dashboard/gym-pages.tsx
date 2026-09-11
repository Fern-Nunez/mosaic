"use client"

import { useSearchParams } from "next/navigation"

import { resolveGymTab } from "@/components/dashboard/views"

/** Picks the Gym sub-page from the URL: your lifts, running, or leaderboard. */
export function GymPages({
  lifts,
  running,
  leaderboard,
}: {
  lifts: React.ReactNode
  running: React.ReactNode
  leaderboard: React.ReactNode
}) {
  const tab = resolveGymTab(useSearchParams().get("tab"))
  if (tab === "running") return running
  if (tab === "leaderboard") return leaderboard
  return lifts
}
