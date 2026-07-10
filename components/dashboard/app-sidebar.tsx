"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { LogOut } from "lucide-react"

import { signout } from "@/app/login/actions"
import {
  DASHBOARD_VIEWS,
  handleViewClick,
  resolveView,
  viewHref,
} from "@/components/dashboard/views"
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const searchParams = useSearchParams()
  const activeView = resolveView(searchParams.get("view"))
  const { isMobile, setOpenMobile } = useSidebar()

  function navigate(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (handleViewClick(event, href) && isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tracking</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DASHBOARD_VIEWS.map((view) => {
                const href = viewHref(view.id)
                return (
                  <SidebarMenuItem key={view.id}>
                    <SidebarMenuButton
                      isActive={view.id === activeView.id}
                      tooltip={view.label}
                      render={
                        <a
                          href={href}
                          onClick={(event) => navigate(event, href)}
                        />
                      }
                    >
                      <view.icon />
                      <span>{view.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              {userEmail}
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={signout}>
              <SidebarMenuButton type="submit" tooltip="Sign out">
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
