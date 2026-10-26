"use client"

import * as React from "react"

import type { AppPrefs } from "@/lib/app/prefs"

type PrefsValue = {
  prefs: AppPrefs
  /** False until the app_prefs migration has been run. */
  ready: boolean
  userId: string
}

const PrefsContext = React.createContext<PrefsValue>({ prefs: {}, ready: true, userId: "" })

/** App settings loaded once in the /app layout; router.refresh() reloads them. */
export function PrefsProvider({ children, ...value }: PrefsValue & { children: React.ReactNode }) {
  const { prefs, ready, userId } = value
  const memo = React.useMemo(() => ({ prefs, ready, userId }), [prefs, ready, userId])
  return <PrefsContext.Provider value={memo}>{children}</PrefsContext.Provider>
}

export function usePrefs() {
  return React.useContext(PrefsContext)
}
