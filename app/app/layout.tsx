import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { PrefsProvider } from "@/components/app/prefs-context"
import { TabBar } from "@/components/app/tab-bar"
import { ThemeRoot } from "@/components/app/theme"
import { THEME_COOKIE } from "@/lib/theme"
import { HabitsProvider } from "@/components/dashboard/habits-context"
import { WorkspaceProvider } from "@/components/dashboard/workspace-context"
import { DEFAULT_WORKSPACES, type Workspace } from "@/lib/workspaces"
import { readPrefs } from "@/lib/app/prefs"
import { createClient } from "@/lib/supabase/server"

/**
 * The new app, built beside the old /dashboard. Same login and session
 * (proxy.ts already guards every non-public route); fresh UI from here down.
 */
export default async function AppLayout({
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

  // Same dashboard (workspace) the old app uses, so data matches between them.
  // "*" so this still works before the app_prefs column exists.
  const { data: settingsData } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()
  const workspaces: Workspace[] =
    Array.isArray(settingsData?.workspaces) && settingsData.workspaces.length > 0
      ? (settingsData.workspaces as Workspace[])
      : DEFAULT_WORKSPACES
  const cookieStore = await cookies()
  const cookieWorkspace = cookieStore.get("mosaic-workspace")?.value
  const theme = cookieStore.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light"
  const activeId = workspaces.some((ws) => ws.id === cookieWorkspace)
    ? cookieWorkspace!
    : workspaces[0].id
  const prefs = readPrefs(settingsData?.app_prefs)
  const prefsReady = settingsData ? "app_prefs" in settingsData : true

  return (
    <WorkspaceProvider
      userId={user.id}
      initialWorkspaces={workspaces}
      initialActiveId={activeId}
    >
      <HabitsProvider userId={user.id}>
        <PrefsProvider prefs={prefs} ready={prefsReady} userId={user.id}>
        <ThemeRoot
          initialTheme={theme}
          className="min-h-svh bg-[#F4F4F4] text-neutral-900 dark:bg-[#0B0B0C] dark:text-neutral-100"
          // Caladea is already loaded in the root layout; this makes it the
          // `font-serif` used for the big headings here.
          style={{ "--font-serif": "var(--font-caladea), Georgia, serif" } as React.CSSProperties}
        >
          {/* Phone-width column; bottom padding keeps content clear of the tab bar. */}
          <main className="mx-auto w-full max-w-[440px] px-6 pt-8 pb-44">
            {children}
          </main>
          <TabBar userId={user.id} />
        </ThemeRoot>
        </PrefsProvider>
      </HabitsProvider>
    </WorkspaceProvider>
  )
}
