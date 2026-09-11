"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { ChevronRight, LogOut } from "lucide-react"

import { signout } from "@/app/login/actions"
import { SettingsDialog } from "@/components/dashboard/settings-dialog"
import {
  DASHBOARD_VIEWS,
  handleViewClick,
  resolveSubPage,
  resolveView,
  SUB_PAGES,
  subPageHref,
  viewHref,
} from "@/components/dashboard/views"
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher"
import { cn } from "@/lib/utils"
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const searchParams = useSearchParams()
  const activeView = resolveView(searchParams.get("view"))
  const activeSubPage = resolveSubPage(activeView.id, searchParams.get("tab"))
  const { isMobile, setOpenMobile } = useSidebar()

  function navigate(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (handleViewClick(event, href) && isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" className="group-data-[side=left]:border-r-0">
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
                const isActive = view.id === activeView.id
                const subPages = SUB_PAGES[view.id]
                return (
                  <SidebarMenuItem key={view.id}>
                    {/* Glowing marker pinned to the sidebar's left edge. */}
                    {isActive && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute top-4 -left-2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_12px_1px_var(--primary)]"
                      />
                    )}
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={view.label}
                      className="data-active:bg-linear-to-r data-active:from-white/10 data-active:to-white/[0.03] data-active:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_0_0_1px_rgb(255_255_255/0.06)]"
                      render={
                        <a
                          href={href}
                          onClick={(event) => navigate(event, href)}
                        />
                      }
                    >
                      <view.icon />
                      <span>{view.label}</span>
                      {isActive && (
                        <ChevronRight
                          className={cn(
                            "ml-auto text-sidebar-foreground/50 transition-transform group-data-[collapsible=icon]:hidden",
                            subPages && "rotate-90"
                          )}
                        />
                      )}
                    </SidebarMenuButton>

                    {/* Sub-pages open underneath while you're in the view. */}
                    {subPages && isActive && (
                      <SidebarMenuSub className="mt-1">
                        {subPages.map((tab) => {
                          const tabHref = subPageHref(view.id, tab.id)
                          return (
                            <SidebarMenuSubItem key={tab.id}>
                              <SidebarMenuSubButton
                                isActive={activeSubPage?.id === tab.id}
                                href={tabHref}
                                onClick={(event) => navigate(event, tabHref)}
                                className="text-sidebar-foreground/70 data-active:text-sidebar-foreground data-active:[&>svg]:text-primary"
                              >
                                <tab.icon />
                                <span>{tab.label}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    )}
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
            <div className="truncate px-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
              {userEmail}
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SettingsDialog />
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
