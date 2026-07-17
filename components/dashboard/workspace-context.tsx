"use client"

import * as React from "react"

import {
  setLocalStorageItem,
  useLocalStorageItem,
} from "@/hooks/use-local-storage"
import { uuid } from "@/lib/utils"

export type Workspace = { id: string; name: string }

const WORKSPACES_KEY = "mosaic:workspaces"
const ACTIVE_KEY = "mosaic:active-workspace"
const DEFAULT_WORKSPACES: Workspace[] = [{ id: "personal", name: "Personal" }]

type WorkspaceContextValue = {
  workspaces: Workspace[]
  active: Workspace
  setActive: (id: string) => void
  addWorkspace: (name: string) => void
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

export function WorkspaceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const workspacesRaw = useLocalStorageItem(WORKSPACES_KEY)
  const activeId = useLocalStorageItem(ACTIVE_KEY)

  const workspaces = React.useMemo<Workspace[]>(() => {
    if (!workspacesRaw) return DEFAULT_WORKSPACES
    try {
      const parsed = JSON.parse(workspacesRaw) as Workspace[]
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : DEFAULT_WORKSPACES
    } catch {
      return DEFAULT_WORKSPACES
    }
  }, [workspacesRaw])

  const value = React.useMemo<WorkspaceContextValue>(() => {
    const active =
      workspaces.find((ws) => ws.id === activeId) ?? workspaces[0]
    return {
      workspaces,
      active,
      setActive: (id) => setLocalStorageItem(ACTIVE_KEY, id),
      addWorkspace: (name) => {
        const id = uuid()
        setLocalStorageItem(
          WORKSPACES_KEY,
          JSON.stringify([...workspaces, { id, name }])
        )
        setLocalStorageItem(ACTIVE_KEY, id)
      },
    }
  }, [workspaces, activeId])

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}
