import type * as React from "react"
import {
  BookOpen,
  Briefcase,
  CircleDot,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  Footprints,
  Moon,
  Receipt,
  Repeat,
  Scale,
  Trophy,
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
    | "sleep"
    | "journal"
    | "habits"
    | "jobs"
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
    id: "sleep",
    label: "Sleep",
    heading: "Sleep",
    description: "Scores and hours, night by night.",
    icon: Moon,
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
  {
    id: "jobs",
    label: "Jobs",
    heading: "Job applications",
    description: "Roles you've applied to and where each one stands.",
    icon: Briefcase,
  },
]

/** Sub-pages of Money, listed under it in the sidebar. */
export const MONEY_TABS = [
  {
    id: "accounts",
    label: "Accounts & cards",
    description: "Balances, credit usage, and activity.",
    icon: CreditCard,
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    description: "What renews, how often, and when.",
    icon: Repeat,
  },
  {
    id: "transactions",
    label: "Recent transactions",
    description: "Your latest account activity.",
    icon: Receipt,
  },
] as const satisfies readonly SubPage[]

export type MoneyTab = (typeof MONEY_TABS)[number]["id"]

/** The Money sub-page in the URL, or null for the Money overview. */
export function resolveMoneyTab(tab: string | null): MoneyTab | null {
  return MONEY_TABS.find((t) => t.id === tab)?.id ?? null
}

export function moneyTabHref(tab: MoneyTab): string {
  return `/dashboard?view=money&tab=${tab}`
}

/** Sub-pages of Gym. The bare Gym view is your own lifts. */
export const GYM_TABS = [
  {
    id: "running",
    label: "Running",
    description: "Runs, pace, and weekly mileage.",
    icon: Footprints,
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    description: "Share a code and see who's on top.",
    icon: Trophy,
  },
] as const satisfies readonly SubPage[]

export type GymTab = (typeof GYM_TABS)[number]["id"]

export function resolveGymTab(tab: string | null): GymTab | null {
  return GYM_TABS.find((t) => t.id === tab)?.id ?? null
}

type SubPage = {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

/** Views that open sub-pages beneath them in the sidebar. */
export const SUB_PAGES: Partial<Record<DashboardView["id"], readonly SubPage[]>> = {
  money: MONEY_TABS,
  gym: GYM_TABS,
}

/** The active sub-page for a view, or undefined on the view's main page. */
export function resolveSubPage(
  view: DashboardView["id"],
  tab: string | null
): SubPage | undefined {
  return SUB_PAGES[view]?.find((t) => t.id === tab)
}

export function subPageHref(view: DashboardView["id"], tab: string): string {
  return `/dashboard?view=${view}&tab=${tab}`
}

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
