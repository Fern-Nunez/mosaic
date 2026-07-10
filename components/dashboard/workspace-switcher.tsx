"use client"

import * as React from "react"
import { Check, ChevronsUpDown, LayoutGrid, Plus } from "lucide-react"

import { useWorkspace } from "@/components/dashboard/workspace-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function WorkspaceSwitcher() {
  const { workspaces, active, setActive, addWorkspace } = useWorkspace()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [name, setName] = React.useState("")

  function createWorkspace(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    addWorkspace(trimmed)
    setName("")
    setDialogOpen(false)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <LayoutGrid className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold tracking-tight">
                    {active.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Mosaic
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56"
            align="start"
          >
            <DropdownMenuLabel>Dashboards</DropdownMenuLabel>
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => setActive(workspace.id)}
              >
                <span className="flex-1 truncate">{workspace.name}</span>
                {workspace.id === active.id && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              New dashboard
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>New dashboard</DialogTitle>
              <DialogDescription>
                Keep separate areas of your life apart — personal, a business,
                a side project.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createWorkspace} className="space-y-4">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Monoscale"
                aria-label="Dashboard name"
                autoFocus
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!name.trim()}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
