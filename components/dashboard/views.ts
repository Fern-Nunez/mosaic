import type * as React from "react"
import {
  BookOpen,
  CircleDot,
  Dumbbell,
  LayoutDashboard,
  Scale,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export type DashboardView = {
  id:
    | "overview"
    | "money"
    | "nutrition"
    | "gym"
    | "weight"
    | "journal"
    | "habits"
  label: string
  heading: string
  description: string
  icon: LucideIcon
}

export const DASHBOARD_VIEWS: DashboardView[] = [
  {
    id: "overview",
    label: "Overview",
    heading: "Your mosaic",
    description: "Everything you're tracking, in one place.",
    icon: LayoutDashboard,
  },
  {
    id: "money",
    label: "Money",
    heading: "Money",
    description: "Income, spending, and where it goes.",
    icon: Wallet,
  },
  {
    id: "nutrition",
    label: "Nutrition",
    heading: "Nutrition",
    description: "Meals, calories, and macros.",
    icon: Utensils,
  },
  {
    id: "gym",
    label: "Gym",
    heading: "Gym",
    description: "Workouts, volume, and personal records.",
    icon: Dumbbell,
  },
  {
    id: "weight",
    label: "Weight",
    heading: "Weight",
    description: "Weigh-ins and body measurements.",
    icon: Scale,
  },
  {
    id: "journal",
    label: "Journal",
    heading: "Journal",
    description: "Entries, moods, and reflections.",
    icon: BookOpen,
  },
  {
    id: "habits",
    label: "Habits",
    heading: "Habits",
    description: "Your daily habits and the dots in the top bar.",
    icon: CircleDot,
  },
]

export function resolveView(view: string | null): DashboardView {
  return DASHBOARD_VIEWS.find((v) => v.id === view) ?? DASHBOARD_VIEWS[0]
}

export function viewHref(id: DashboardView["id"]): string {
  return id === "overview" ? "/dashboard" : `/dashboard?view=${id}`
}

// Same-page view switches only need a URL update, not a server round
// trip — pushState keeps useSearchParams in sync per the Next.js docs.
// Returns false when the click should fall through to the browser
// (modified clicks like ctrl/cmd for new tabs).
export function handleViewClick(
  event: React.MouseEvent<HTMLAnchorElement>,
  href: string
): boolean {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false
  }
  event.preventDefault()
  window.history.pushState(null, "", href)
  return true
}
