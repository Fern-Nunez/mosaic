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
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {view.heading}
        </h1>
        <p className="text-sm text-muted-foreground">{view.description}</p>
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
