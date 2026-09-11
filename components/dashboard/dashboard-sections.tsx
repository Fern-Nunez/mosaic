"use client"

import { useSearchParams } from "next/navigation"

import {
  MONEY_TABS,
  resolveMoneyTab,
  resolveView,
  type DashboardView,
} from "@/components/dashboard/views"

export function DashboardSections({
  views,
}: {
  views: Record<DashboardView["id"], React.ReactNode>
}) {
  const searchParams = useSearchParams()
  const view = resolveView(searchParams.get("view"))
  // Money sub-pages take their heading from the sub-page itself.
  const moneyTab =
    view.id === "money"
      ? MONEY_TABS.find((t) => t.id === resolveMoneyTab(searchParams.get("tab")))
      : undefined

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {moneyTab?.label ?? view.heading}
        </h1>
        <p className="text-sm text-muted-foreground">
          {moneyTab?.description ?? view.description}
        </p>
      </div>
      <div className="min-h-0 flex-1">{views[view.id]}</div>
    </div>
  )
}

export function DashboardTitle() {
  const searchParams = useSearchParams()
  const view = resolveView(searchParams.get("view"))

  return <span className="text-sm font-medium">{view.label}</span>
}
