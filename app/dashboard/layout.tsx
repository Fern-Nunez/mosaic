import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { HabitDots } from "@/components/dashboard/habit-dots"
import { HabitsProvider } from "@/components/dashboard/habits-context"
import { NavPrefsProvider } from "@/components/dashboard/nav-prefs"
import {
  ScratchPanel,
  ScratchPanelProvider,
  ScratchPanelTrigger,
} from "@/components/dashboard/scratch-panel"
import { DASHBOARD_VIEWS, type DashboardView } from "@/components/dashboard/views"
import { WorkspaceProvider } from "@/components/dashboard/workspace-context"
import { DEFAULT_WORKSPACES, type Workspace } from "@/lib/workspaces"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"
  const scratchOpen = cookieStore.get("scratch_panel_state")?.value !== "false"

  // The dashboard list lives on user_settings so it syncs across devices.
  // Read defensively: if the workspaces migration hasn't been applied yet,
  // fall back to the default so the app still loads.
  const { data: settingsData } = await supabase
    .from("user_settings")
    .select("workspaces")
    .eq("user_id", user.id)
    .maybeSingle()

  const workspaces: Workspace[] =
    Array.isArray(settingsData?.workspaces) && settingsData.workspaces.length > 0
      ? (settingsData.workspaces as Workspace[])
      : DEFAULT_WORKSPACES

  // Sidebar pages switched off in Settings. Its own query so a missing
  // column (migration not run) only loses this, not the dashboards list.
  const { data: navData } = await supabase
    .from("user_settings")
    .select("hidden_views")
    .eq("user_id", user.id)
    .maybeSingle()
  const hiddenViews = (
    Array.isArray(navData?.hidden_views) ? navData.hidden_views : []
  ).filter((id): id is DashboardView["id"] =>
    DASHBOARD_VIEWS.some((v) => v.id === id && v.id !== "overview")
  )

  const cookieWorkspace = cookieStore.get("mosaic-workspace")?.value
  const activeId = workspaces.some((ws) => ws.id === cookieWorkspace)
    ? cookieWorkspace!
    : workspaces[0].id

  return (
    <WorkspaceProvider
      userId={user.id}
      initialWorkspaces={workspaces}
      initialActiveId={activeId}
    >
      <NavPrefsProvider userId={user.id} initialHidden={hiddenViews}>
      <HabitsProvider userId={user.id}>
      <SidebarProvider
        defaultOpen={defaultOpen}
        className="dark bg-background text-foreground"
      >
        <ScratchPanelProvider defaultOpen={scratchOpen} userId={user.id}>
          <AppSidebar userEmail={user.email ?? ""} />
          <SidebarInset className="bg-background">
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              {/* Daily-habit "dopamine dots", centered across the bar. */}
              <div className="pointer-events-none absolute left-1/2 -translate-x-1/2">
                <div className="pointer-events-auto">
                  <HabitDots />
                </div>
              </div>
              <ScratchPanelTrigger className="ml-auto" />
            </header>
            <div className="flex flex-1 items-start">
              <div className="flex min-w-0 flex-1 flex-col self-stretch px-4 py-6">
                {children}
              </div>
            </div>
          </SidebarInset>
          {/* Full-height right panel, a sibling of the main area so it
              spans the whole viewport like the left sidebar. */}
          <ScratchPanel />
        </ScratchPanelProvider>
      </SidebarProvider>
      </HabitsProvider>
      </NavPrefsProvider>
    </WorkspaceProvider>
  )
}
