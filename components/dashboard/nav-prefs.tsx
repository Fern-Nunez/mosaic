"use client"

import * as React from "react"

import { createClient } from "@/lib/supabase/client"
import type { DashboardView } from "@/components/dashboard/views"

type ViewId = DashboardView["id"]

type NavPrefsValue = {
  hiddenViews: ViewId[]
  /** Resolves to an error message, or null on success. */
  setViewHidden: (id: ViewId, hidden: boolean) => Promise<string | null>
}

const NavPrefsContext = React.createContext<NavPrefsValue | null>(null)

export function useNavPrefs() {
  const context = React.useContext(NavPrefsContext)
  if (!context) {
    throw new Error("useNavPrefs must be used within a NavPrefsProvider.")
  }
  return context
}

/** Which sidebar pages are switched off, saved to user_settings. */
export function NavPrefsProvider({
  userId,
  initialHidden,
  children,
}: {
  userId: string
  initialHidden: ViewId[]
  children: React.ReactNode
}) {
  const supabase = React.useMemo(() => createClient(), [])
  const [hiddenViews, setHiddenViews] = React.useState<ViewId[]>(initialHidden)

  const value = React.useMemo<NavPrefsValue>(
    () => ({
      hiddenViews,
      setViewHidden: async (id, hidden) => {
        if (id === "overview") return null
        const prev = hiddenViews
        const next = hidden
          ? [...new Set([...prev, id])]
          : prev.filter((v) => v !== id)
        // Flip it right away; put it back if the save fails.
        setHiddenViews(next)
        const { error } = await supabase
          .from("user_settings")
          .upsert(
            { user_id: userId, hidden_views: next },
            { onConflict: "user_id" }
          )
        if (!error) return null
        setHiddenViews(prev)
        return /column|schema cache/i.test(error.message)
          ? "Run supabase/migrations/20260910_hidden_views.sql in Supabase, then try again."
          : error.message
      },
    }),
    [hiddenViews, supabase, userId]
  )

  return (
    <NavPrefsContext.Provider value={value}>{children}</NavPrefsContext.Provider>
  )
}
