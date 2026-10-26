"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CircleEllipsis,
  MessageSquareMore,
  Plus,
  type LucideProps,
} from "lucide-react"

import { LogSheet } from "@/components/app/log/log-sheet"
import { usePrefs } from "@/components/app/prefs-context"
import { QUICK_ACTIONS, type LoggerId } from "@/components/app/quick-actions"
import type { SectionId } from "@/lib/app/prefs"
import { cn } from "@/lib/utils"

// Colors straight from the Figma frames.
const GREEN = "#318E63"
const IDLE = "#AAAAAA"
// Sits a bit above the bottom edge (and above the iPhone home bar).
const BAR_BOTTOM = "max(24px, calc(env(safe-area-inset-bottom) + 8px))"

// Drawn to match the Figma tab icons (lucide has no exact match).
function TodayIcon({ strokeWidth = 1.5, ...props }: LucideProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} {...props}>
      <rect x="3" y="4.5" width="8" height="6" rx="1.5" />
      <rect x="3" y="13.5" width="8" height="5" rx="1.5" />
      <rect x="14" y="7" width="7" height="11.5" rx="1.5" />
    </svg>
  )
}

function TrendsIcon({ strokeWidth = 1.5, ...props }: LucideProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} {...props}>
      <rect x="3.5" y="12" width="4" height="8.5" rx="1" />
      <rect x="10" y="8" width="4" height="12.5" rx="1" />
      <rect x="16.5" y="3.5" width="4" height="17" rx="1" />
    </svg>
  )
}

const TABS: {
  label: string
  href: string
  icon: React.ComponentType<LucideProps>
}[] = [
  { label: "Today", href: "/app", icon: TodayIcon },
  { label: "Trends", href: "/app/trends", icon: TrendsIcon },
  { label: "Insights", href: "/app/insights", icon: MessageSquareMore },
  { label: "More", href: "/app/more", icon: CircleEllipsis },
]

function isActive(pathname: string, href: string) {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`)
}

/** Bottom navigation for /app: Today · Trends · (+) · Insights · More. */
const ACTION_SECTION: Partial<Record<LoggerId, SectionId>> = {
  money: "money",
  workout: "workout",
  journal: "journal",
  sleep: "sleep",
  weight: "weight",
  nutrition: "nutrition",
  supplement: "supplements",
}

export function TabBar({ userId }: { userId: string }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [logger, setLogger] = React.useState<LoggerId | null>(null)
  const [mealPhoto, setMealPhoto] = React.useState<File | null>(null)
  // Opened from inside the tap handler itself; phones only allow the camera
  // to open as a direct result of a tap.
  const cameraInput = React.useRef<HTMLInputElement>(null)
  const firstItemRef = React.useRef<HTMLButtonElement>(null)
  // Only move focus into the menu for keyboard users; on touch it would
  // just look like the first item is pre-selected.
  const openedByKeyboard = React.useRef(false)
  // Sections switched off in More drop out of the menu. Notes and Task stay.
  const { prefs } = usePrefs()
  const actions = QUICK_ACTIONS.filter((a) => {
    const section = ACTION_SECTION[a.id]
    return !section || !prefs.hiddenSections?.includes(section)
  })

  React.useEffect(() => {
    if (!menuOpen) return
    if (openedByKeyboard.current) firstItemRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen])

  function openLogger(id: LoggerId) {
    setMenuOpen(false)
    if (id === "nutrition") {
      setMealPhoto(null)
      cameraInput.current?.click()
    }
    // The form opens underneath, so cancelling the camera still lets you
    // type the meal in.
    setLogger(id)
  }

  // The tab you tapped lights up right away, before the page arrives, and
  // tapping it again while it loads doesn't restart the navigation.
  const [pending, setPending] = React.useState<{ href: string; from: string } | null>(null)
  const pendingHref = pending && pending.from === pathname ? pending.href : null

  const tabLink = (tab: (typeof TABS)[number]) => {
    const active = isActive(pendingHref ?? pathname, tab.href)
    return (
      <Link
        key={tab.href}
        href={tab.href}
        onClick={(event) => {
          if (pendingHref === tab.href) event.preventDefault()
          else if (pathname !== tab.href) setPending({ href: tab.href, from: pathname })
        }}
        aria-label={tab.label}
        aria-current={active ? "page" : undefined}
        className="flex h-full flex-1 flex-col items-center justify-center gap-1.5 outline-none focus-visible:[&>svg]:scale-110"
      >
        <tab.icon
          className="size-[22px] transition-colors"
          strokeWidth={1.5}
          style={{ color: active ? GREEN : IDLE }}
        />
        <span
          aria-hidden
          className={cn(
            "size-1 rounded-full transition-opacity",
            active ? "opacity-100" : "opacity-0"
          )}
          style={{ backgroundColor: GREEN }}
        />
      </Link>
    )
  }

  return (
    <>
      {/* The bar. It sits under the dim layer, so it dims with the page. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-3 z-30 mx-auto flex h-[60px] max-w-[420px] drop-shadow-[0_2px_6px_rgb(0_0_0/0.08)]"
        style={{ bottom: BAR_BOTTOM }}
      >
        {/* Two white halves joined by a notch the round button sits in. */}
        <div className="flex flex-1 items-stretch rounded-l-[20px] bg-white dark:bg-neutral-900">
          {TABS.slice(0, 2).map(tabLink)}
        </div>
        <svg
          aria-hidden
          viewBox="0 0 120 60"
          // Overlaps each white half by 1px so Safari can't leave a hairline
          // gap at the seams when the bar width isn't a whole pixel.
          className="relative -mx-px block h-[60px] w-[122px] shrink-0"
          preserveAspectRatio="none"
        >
          <path
            d="M0 0 C22 0 26 32 60 32 C94 32 98 0 120 0 V60 H0 Z"
            className="fill-white dark:fill-neutral-900"
          />
        </svg>
        <div className="flex flex-1 items-stretch rounded-r-[20px] bg-white dark:bg-neutral-900">
          {TABS.slice(2).map(tabLink)}
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

      {/* Above the dim layer: the quick-log grid and the round button, on
          the same footprint as the bar so the button lines up with the notch. */}
      <div
        className="pointer-events-none fixed inset-x-3 z-50 mx-auto h-[60px] max-w-[420px]"
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
            // Raised a little above the bar; the round button still overlaps its
            // bottom edge so the two read as one shape.
            "absolute inset-x-0 bottom-[70px] origin-bottom rounded-[20px] px-5 pt-5 pb-9 shadow-[0_6px_16px_rgb(0_0_0/0.25)] transition-all duration-200 ease-out",
            menuOpen
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "translate-y-3 scale-95 opacity-0"
          )}
          style={{ backgroundColor: GREEN }}
        >
          {/* Columns size to their longest label and share the leftover space,
              so "Supplement" doesn't crowd the column next to it. */}
          <div className="grid grid-cols-[repeat(3,auto)] justify-between gap-y-1">
            {actions.map((action, index) => (
              <button
                key={action.id}
                ref={index === 0 ? firstItemRef : undefined}
                type="button"
                onClick={() => openLogger(action.id)}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-[15px] text-white outline-none transition-colors active:bg-white/15 focus-visible:bg-white/15"
              >
                <action.icon className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="whitespace-nowrap">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => {
            // detail is 0 when the click came from Enter/Space, not a tap.
            openedByKeyboard.current = event.detail === 0
            setMenuOpen((open) => !open)
          }}
          aria-label={menuOpen ? "Close" : "Log something"}
          aria-expanded={menuOpen}
          className={cn(
            "pointer-events-auto absolute top-0 left-1/2 flex size-[54px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-white outline-none transition-[transform,box-shadow] active:scale-95 focus-visible:ring-2 focus-visible:ring-white/70",
            // No shadow while open, so it melts into the green box above it.
            !menuOpen && "shadow-[0_4px_10px_rgb(0_0_0/0.2)]"
          )}
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

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (file) setMealPhoto(file)
        }}
      />
      <LogSheet
        logger={logger}
        userId={userId}
        mealPhoto={mealPhoto}
        onClose={() => {
          setLogger(null)
          setMealPhoto(null)
        }}
      />
    </>
  )
}
