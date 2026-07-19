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
  DropdownMenuGroup,
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
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    const err = await addWorkspace(trimmed)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
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
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    Mosaic
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/50" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56"
            align="start"
          >
            {/* GroupLabel throws unless it's inside a Menu.Group — this
                wrapper is what makes the switcher open without crashing. */}
            <DropdownMenuGroup>
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
            </DropdownMenuGroup>
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
              {error && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!name.trim() || busy}>
                  {busy ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
