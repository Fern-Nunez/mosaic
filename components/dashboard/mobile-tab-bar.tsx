"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  BookOpen,
  CircleEllipsis,
  Dumbbell,
  ListTodo,
  MessageSquareMore,
  Moon,
  NotebookPen,
  Pill,
  Plus,
  Scale,
  Utensils,
  Wallet,
  type LucideIcon,
  type LucideProps,
} from "lucide-react"

import { useScratchPanel } from "@/components/dashboard/scratch-panel"
import {
  resolveView,
  viewHref,
  type DashboardView,
} from "@/components/dashboard/views"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// Colors straight from the Figma frames.
const GREEN = "#318E63"
const IDLE = "#AAAAAA"
const BAR_BOTTOM = "max(12px, env(safe-area-inset-bottom))"

type ViewId = DashboardView["id"]
type TabIcon = React.ComponentType<LucideProps>

// Drawn to match the Figma tab icons (lucide has no exact match).
function TodayIcon(props: LucideProps) {
  const { strokeWidth = 1.5, ...rest } = props
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} {...rest}>
      <rect x="3" y="4.5" width="8" height="6" rx="1.5" />
      <rect x="3" y="13.5" width="8" height="5" rx="1.5" />
      <rect x="14" y="7" width="7" height="11.5" rx="1.5" />
    </svg>
  )
}

function TrendsIcon(props: LucideProps) {
  const { strokeWidth = 1.5, ...rest } = props
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} {...rest}>
      <rect x="3.5" y="12" width="4" height="8.5" rx="1" />
      <rect x="10" y="8" width="4" height="12.5" rx="1" />
      <rect x="16.5" y="3.5" width="4" height="17" rx="1" />
    </svg>
  )
}

/** Category pages that live under the Trends tab. */
const TREND_VIEWS: ViewId[] = [
  "trends",
  "money",
  "nutrition",
  "gym",
  "weight",
  "sleep",
  "journal",
  "habits",
  "jobs",
]

type QuickAction =
  | { label: string; icon: LucideIcon; view: ViewId }
  | { label: string; icon: LucideIcon; scratch: "notes" | "todos" }
  | { label: string; icon: LucideIcon; soon: true }

// Same order as the Figma grid: read left to right, top to bottom.
const QUICK_ACTIONS: QuickAction[] = [
  { label: "Money", icon: Wallet, view: "money" },
  { label: "Workout", icon: Dumbbell, view: "gym" },
  { label: "Journal", icon: BookOpen, view: "journal" },
  { label: "Sleep", icon: Moon, view: "sleep" },
  { label: "Weight", icon: Scale, view: "weight" },
  { label: "Notes", icon: NotebookPen, scratch: "notes" },
  { label: "Nutrition", icon: Utensils, view: "nutrition" },
  { label: "Supplement", icon: Pill, soon: true },
  { label: "Task", icon: ListTodo, scratch: "todos" },
]

function go(href: string) {
  // Same-page view switch, like the sidebar does (keeps useSearchParams in sync).
  window.history.pushState(null, "", href)
  window.scrollTo({ top: 0 })
}

/**
 * Phone-only bottom navigation: Today · Trends · (+) · Insights · More.
 * The + opens a quick-log grid over a dimmed screen. Hidden at md and up,
 * where the sidebar takes over.
 */
export function MobileTabBar() {
  const searchParams = useSearchParams()
  const activeView = resolveView(searchParams.get("view"))
  const { setOpenMobile, openMobile: moreOpen } = useSidebar()
  const { openTo } = useScratchPanel()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const firstItemRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!menuOpen) return
    firstItemRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen])

  function runAction(action: QuickAction) {
    if ("soon" in action) return
    setMenuOpen(false)
    if ("view" in action) go(viewHref(action.view))
    else openTo(action.scratch)
  }

  const tabs: {
    label: string
    icon: TabIcon
    active: boolean
    onClick: () => void
  }[] = [
    {
      label: "Today",
      icon: TodayIcon,
      active: activeView.id === "overview" && !moreOpen,
      onClick: () => go(viewHref("overview")),
    },
    {
      label: "Trends",
      icon: TrendsIcon,
      active: TREND_VIEWS.includes(activeView.id) && !moreOpen,
      onClick: () => go(viewHref("trends")),
    },
    {
      label: "Insights",
      icon: MessageSquareMore,
      active: activeView.id === "insights" && !moreOpen,
      onClick: () => go(viewHref("insights")),
    },
    {
      label: "More",
      icon: CircleEllipsis,
      active: moreOpen,
      // The existing sidebar drawer holds settings, sign out and every page.
      onClick: () => setOpenMobile(true),
    },
  ]

  const tabButton = (tab: (typeof tabs)[number]) => (
    <button
      key={tab.label}
      type="button"
      onClick={tab.onClick}
      aria-label={tab.label}
      aria-current={tab.active ? "page" : undefined}
      className="flex h-full flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 outline-none focus-visible:[&>svg]:scale-110"
    >
      <tab.icon
        className="size-[22px] transition-colors"
        strokeWidth={1.5}
        style={{ color: tab.active ? GREEN : IDLE }}
      />
      <span
        aria-hidden
        className={cn(
          "size-1 rounded-full transition-opacity",
          tab.active ? "opacity-100" : "opacity-0"
        )}
        style={{ backgroundColor: GREEN }}
      />
    </button>
  )

  return (
    <div className="md:hidden">
      {/* Dim layer behind the quick-log menu (Figma: #000 at 40%). */}
      <div
        aria-hidden
        onClick={() => setMenuOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* The bar. It sits under the dim layer, so it dims with the page. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-3 z-30 flex h-[60px] drop-shadow-[0_2px_6px_rgb(0_0_0/0.08)]"
        style={{ bottom: BAR_BOTTOM }}
      >
        {/* Two white halves joined by a notch the round button sits in. */}
        <div className="flex flex-1 items-stretch rounded-l-[20px] bg-white">
          {tabs.slice(0, 2).map(tabButton)}
        </div>
        <svg
          aria-hidden
          viewBox="0 0 120 60"
          className="block h-[60px] w-[120px] shrink-0"
          preserveAspectRatio="none"
        >
          <path
            d="M0 0 C22 0 26 32 60 32 C94 32 98 0 120 0 V60 H0 Z"
            fill="#FFFFFF"
          />
        </svg>
        <div className="flex flex-1 items-stretch rounded-r-[20px] bg-white">
          {tabs.slice(2).map(tabButton)}
        </div>
      </nav>

      {/* Dim layer behind the quick-log menu (Figma: #000 at 40%). */}
      <div
        aria-hidden
        onClick={() => setMenuOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Above the dim layer: the quick-log grid and the round button. Same
          footprint as the bar, so the button lines up with the notch. */}
      <div
        className="pointer-events-none fixed inset-x-3 z-50 h-[60px]"
        style={{ bottom: BAR_BOTTOM }}
      >
        {/* Its bottom edge runs through the center of the round button. */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Log something"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
          className={cn(
            "absolute inset-x-0 bottom-[60px] origin-bottom rounded-[18px] px-5 pt-5 pb-7 shadow-[0_6px_16px_rgb(0_0_0/0.25)] transition-all duration-200 ease-out",
            menuOpen
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "translate-y-3 scale-95 opacity-0"
          )}
          style={{ backgroundColor: GREEN }}
        >
          <div className="grid grid-cols-3 gap-x-1">
            {QUICK_ACTIONS.map((action, index) => {
              const soon = "soon" in action
              return (
                <button
                  key={action.label}
                  ref={index === 0 ? firstItemRef : undefined}
                  type="button"
                  onClick={() => runAction(action)}
                  disabled={soon}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-lg px-1.5 text-left text-sm text-white outline-none transition-colors",
                    soon
                      ? "cursor-default opacity-50"
                      : "cursor-pointer active:bg-white/15 focus-visible:bg-white/15"
                  )}
                >
                  <action.icon className="size-4 shrink-0" strokeWidth={1.75} />
                  <span className="whitespace-nowrap">
                    {action.label}
                    {soon && <span className="sr-only"> (coming soon)</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close" : "Log something"}
          aria-expanded={menuOpen}
          className="pointer-events-auto absolute top-0 left-1/2 flex size-[54px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-white shadow-[0_4px_10px_rgb(0_0_0/0.2)] outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-white/70"
          style={{ backgroundColor: GREEN }}
        >
          <Plus
            className={cn(
              "size-7 transition-transform duration-200",
              menuOpen && "rotate-45"
            )}
            strokeWidth={1.5}
          />
        </button>
      </div>
    </div>
  )
}
