"use client"

import { useSearchParams } from "next/navigation"

import { resolveView, type DashboardView } from "@/components/dashboard/views"

export function DashboardSections({
  views,
}: {
  views: Record<DashboardView["id"], React.ReactNode>
}) {
  const searchParams = useSearchParams()
  const view = resolveView(searchParams.get("view"))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {view.heading}
        </h1>
        <p className="text-sm text-muted-foreground">{view.description}</p>
      </div>
      {views[view.id]}
    </div>
  )
}

export function DashboardTitle() {
  const searchParams = useSearchParams()
  const view = resolveView(searchParams.get("view"))

  return <span className="text-sm font-medium">{view.label}</span>
}
