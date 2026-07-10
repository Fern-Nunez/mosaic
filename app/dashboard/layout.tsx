import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { DashboardTitle } from "@/components/dashboard/dashboard-sections"
import { MobileViewNav } from "@/components/dashboard/mobile-view-nav"
import {
  ScratchPanel,
  ScratchPanelProvider,
  ScratchPanelTrigger,
} from "@/components/dashboard/scratch-panel"
import { WorkspaceProvider } from "@/components/dashboard/workspace-context"
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

  return (
    <WorkspaceProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <ScratchPanelProvider defaultOpen={scratchOpen} userId={user.id}>
          <AppSidebar userEmail={user.email ?? ""} />
          <SidebarInset className="bg-muted/40">
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <DashboardTitle />
              <ScratchPanelTrigger className="ml-auto" />
            </header>
            <MobileViewNav />
            <div className="flex flex-1 items-start">
              <div className="min-w-0 flex-1 px-4 py-6">{children}</div>
              <ScratchPanel />
            </div>
          </SidebarInset>
        </ScratchPanelProvider>
      </SidebarProvider>
    </WorkspaceProvider>
  )
}
