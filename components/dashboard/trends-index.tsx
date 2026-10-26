"use client"

import { ChevronRight } from "lucide-react"

import { useNavPrefs } from "@/components/dashboard/nav-prefs"
import {
  DASHBOARD_VIEWS,
  handleViewClick,
  viewHref,
} from "@/components/dashboard/views"

/**
 * Temporary Trends tab: links to every category page the user has switched
 * on. The real version (range picker, sparkline cards, compare) comes next.
 */
export function TrendsIndex() {
  const { hiddenViews } = useNavPrefs()
  const views = DASHBOARD_VIEWS.filter(
    (view) => view.id !== "overview" && !hiddenViews.includes(view.id)
  )

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
      {views.map((view) => {
        const href = viewHref(view.id)
        return (
          <a
            key={view.id}
            href={href}
            onClick={(event) => {
              if (handleViewClick(event, href)) window.scrollTo({ top: 0 })
            }}
            className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted"
          >
            <view.icon className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{view.label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {view.description}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </a>
        )
      })}
    </div>
  )
}
