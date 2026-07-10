"use client"

import { useSearchParams } from "next/navigation"

import {
  DASHBOARD_VIEWS,
  handleViewClick,
  resolveView,
  viewHref,
} from "@/components/dashboard/views"
import { cn } from "@/lib/utils"

// Visible view switcher for small screens, where the sidebar is
// tucked away behind the hamburger trigger.
export function MobileViewNav() {
  const searchParams = useSearchParams()
  const activeView = resolveView(searchParams.get("view"))

  return (
    <nav className="sticky top-14 z-10 border-b bg-background/80 backdrop-blur md:hidden">
      <div className="flex gap-1 overflow-x-auto px-2 py-1.5">
        {DASHBOARD_VIEWS.map((view) => {
          const href = viewHref(view.id)
          const isActive = view.id === activeView.id
          return (
            <a
              key={view.id}
              href={href}
              onClick={(event) => handleViewClick(event, href)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <view.icon className="size-3.5" />
              {view.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
