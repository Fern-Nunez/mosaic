// Cardio that isn't a run (runs keep their own table for the leaderboard).
// Shared by the logger, Today, the Workout page and reminders.

import { Bike, Footprints, Mountain, PersonStanding, Waves, type LucideIcon } from "lucide-react"

export type CardioActivity = "bike" | "swim" | "walk" | "hike"

export const CARDIO: Record<CardioActivity, { label: string; noun: string; plural: string; icon: LucideIcon; emoji: string }> = {
  bike: { label: "Bike", noun: "Bike ride", plural: "Rides", icon: Bike, emoji: "🚴" },
  swim: { label: "Swim", noun: "Swim", plural: "Swims", icon: Waves, emoji: "🏊" },
  walk: { label: "Walk", noun: "Walk", plural: "Walks", icon: PersonStanding, emoji: "🚶" },
  hike: { label: "Hike", noun: "Hike", plural: "Hikes", icon: Mountain, emoji: "🥾" },
}

/** Runs use this icon everywhere. */
export const RUN_ICON = Footprints
