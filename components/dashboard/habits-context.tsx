"use client"

import * as React from "react"

import { useWorkspace } from "@/components/dashboard/workspace-context"
import { createClient } from "@/lib/supabase/client"
import { uuid } from "@/lib/utils"
import {
  dateKey,
  normalizeCalendars,
  type Calendar,
  type Completion,
  type Habit,
} from "@/lib/habits"

type HabitsContextValue = {
  habits: Habit[]
  completions: Completion[]
  calendars: Calendar[]
  /** True when the Supabase tables can't be read (migration not applied). */
  loadError: boolean
  addHabit: (name: string, icon: string) => void
  removeHabit: (id: string) => void
  toggleToday: (habitId: string) => void
  /** Returns an error message, or null on success. */
  addCalendar: (name: string, input: string) => string | null
  removeCalendar: (index: number) => void
}

const HabitsContext = React.createContext<HabitsContextValue | null>(null)

export function useHabits() {
  const context = React.useContext(HabitsContext)
  if (!context) {
    throw new Error("useHabits must be used within a HabitsProvider.")
  }
  return context
}

// Accepts either a raw embed URL or the full <iframe …> snippet Google
// gives you, and only trusts calendar.google.com.
export function extractCalendarUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const srcMatch = trimmed.match(/src="([^"]+)"/)
  const candidate = srcMatch ? srcMatch[1] : trimmed
  try {
    const url = new URL(candidate)
    if (url.hostname === "calendar.google.com") return url.toString()
  } catch {
    // not a URL
  }
  return null
}

export function HabitsProvider({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const { active } = useWorkspace()
  const workspace = active.id
  const supabase = React.useMemo(() => createClient(), [])

  const [habits, setHabits] = React.useState<Habit[]>([])
  const [completions, setCompletions] = React.useState<Completion[]>([])
  const [calendars, setCalendars] = React.useState<Calendar[]>([])
  const [loadError, setLoadError] = React.useState(false)

  // Reload from Supabase whenever the active workspace changes.
  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase
        .from("habits")
        .select("id, name, icon, position")
        .eq("workspace", workspace)
        .order("position", { ascending: true }),
      supabase
        .from("habit_completions")
        .select("habit_id, date")
        .eq("workspace", workspace),
      supabase.from("user_settings").select("calendars").maybeSingle(),
    ]).then(([habitsRes, compRes, settingsRes]) => {
      if (cancelled) return
      if (habitsRes.error || compRes.error) {
        setLoadError(true)
        setHabits([])
        setCompletions([])
      } else {
        setLoadError(false)
        setHabits(
          (habitsRes.data ?? []).map((row) => ({
            id: row.id as string,
            name: row.name as string,
            icon: row.icon as string,
          }))
        )
        setCompletions(
          (compRes.data ?? []).map((row) => ({
            habitId: row.habit_id as string,
            date: row.date as string,
          }))
        )
      }
      const map = (settingsRes.data?.calendars ?? {}) as Record<
        string,
        unknown
      >
      setCalendars(normalizeCalendars(map[workspace]))
    })
    return () => {
      cancelled = true
    }
  }, [supabase, workspace])

  // Read-modify-write so saving one dashboard's calendars can't clobber
  // another's (they share one JSON column on the settings row).
  const persistCalendars = React.useCallback(
    async (next: Calendar[]) => {
      const { data } = await supabase
        .from("user_settings")
        .select("calendars")
        .maybeSingle()
      const map = (data?.calendars ?? {}) as Record<string, unknown>
      map[workspace] = next
      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id: userId, calendars: map }, { onConflict: "user_id" })
      if (error) setLoadError(true)
    },
    [supabase, userId, workspace]
  )

  const value = React.useMemo<HabitsContextValue>(() => {
    return {
      habits,
      completions,
      calendars,
      loadError,
      addHabit: (name, icon) => {
        const habit: Habit = { id: uuid(), name, icon }
        const position = habits.length
        setHabits([...habits, habit])
        supabase
          .from("habits")
          .insert({ id: habit.id, name, icon, position, user_id: userId, workspace })
          .then(({ error }) => {
            if (error) setHabits(habits)
          })
      },
      removeHabit: (id) => {
        const prevHabits = habits
        const prevCompletions = completions
        setHabits(habits.filter((habit) => habit.id !== id))
        setCompletions(completions.filter((c) => c.habitId !== id))
        supabase
          .from("habits")
          .delete()
          .eq("id", id)
          .then(({ error }) => {
            if (error) {
              setHabits(prevHabits)
              setCompletions(prevCompletions)
            }
          })
      },
      toggleToday: (habitId) => {
        const today = dateKey(new Date())
        const exists = completions.some(
          (c) => c.habitId === habitId && c.date === today
        )
        const prev = completions
        if (exists) {
          setCompletions(
            completions.filter(
              (c) => !(c.habitId === habitId && c.date === today)
            )
          )
          supabase
            .from("habit_completions")
            .delete()
            .eq("habit_id", habitId)
            .eq("date", today)
            .then(({ error }) => {
              if (error) setCompletions(prev)
            })
        } else {
          setCompletions([...completions, { habitId, date: today }])
          supabase
            .from("habit_completions")
            .insert({
              id: uuid(),
              habit_id: habitId,
              date: today,
              user_id: userId,
              workspace,
            })
            .then(({ error }) => {
              if (error) setCompletions(prev)
            })
        }
      },
      addCalendar: (name, input) => {
        const url = extractCalendarUrl(input)
        if (!url) return "That doesn't look like a Google Calendar embed link."
        const next = [...calendars, { name: name.trim() || "Calendar", url }]
        setCalendars(next)
        persistCalendars(next)
        return null
      },
      removeCalendar: (index) => {
        const next = calendars.filter((_, i) => i !== index)
        setCalendars(next)
        persistCalendars(next)
      },
    }
  }, [
    habits,
    completions,
    calendars,
    loadError,
    supabase,
    userId,
    workspace,
    persistCalendars,
  ])

  return (
    <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>
  )
}
