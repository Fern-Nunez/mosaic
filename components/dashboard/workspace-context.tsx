"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"
import { uuid } from "@/lib/utils"
import type { Workspace } from "@/lib/workspaces"

export type { Workspace }

// The server reads this cookie to filter every query by dashboard.
const ACTIVE_COOKIE = "mosaic-workspace"

type WorkspaceContextValue = {
  workspaces: Workspace[]
  active: Workspace
  setActive: (id: string) => void
  /** Resolves to an error message, or null on success. */
  addWorkspace: (name: string) => Promise<string | null>
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(
  null
)

export function useWorkspace() {
  const context = React.useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider.")
  }
  return context
}

function setActiveCookie(id: string) {
  document.cookie = `${ACTIVE_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`
}

export function WorkspaceProvider({
  userId,
  initialWorkspaces,
  initialActiveId,
  children,
}: {
  userId: string
  initialWorkspaces: Workspace[]
  initialActiveId: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])

  const [workspaces, setWorkspaces] =
    React.useState<Workspace[]>(initialWorkspaces)
  const [activeId, setActiveId] = React.useState(initialActiveId)

  const value = React.useMemo<WorkspaceContextValue>(() => {
    const active =
      workspaces.find((ws) => ws.id === activeId) ?? workspaces[0]
    return {
      workspaces,
      active,
      setActive: (id) => {
        setActiveId(id)
        setActiveCookie(id)
        // Server components refetch with the new cookie, so every tab
        // shows this dashboard's data.
        router.refresh()
      },
      addWorkspace: async (name) => {
        const id = uuid()
        const next = [...workspaces, { id, name }]
        const { error } = await supabase
          .from("user_settings")
          .upsert(
            { user_id: userId, workspaces: next },
            { onConflict: "user_id" }
          )
        if (error) {
          // Most likely the workspaces migration hasn't been applied.
          return /column|schema cache/i.test(error.message)
            ? "Dashboard columns are missing. Run the workspaces migration in Supabase, then try again."
            : error.message
        }
        setWorkspaces(next)
        setActiveId(id)
        setActiveCookie(id)
        router.refresh()
        return null
      },
    }
  }, [workspaces, activeId, router, supabase, userId])

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}
