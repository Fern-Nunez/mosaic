"use client"

import * as React from "react"

import { useWorkspace } from "@/components/dashboard/workspace-context"
import { createClient } from "@/lib/supabase/client"
import { uuid } from "@/lib/utils"
import { dateKey, type Completion, type Habit } from "@/lib/habits"

type HabitsContextValue = {
  habits: Habit[]
  completions: Completion[]
  /** True when the Supabase tables can't be read (migration not applied). */
  loadError: boolean
  addHabit: (name: string, icon: string) => void
  removeHabit: (id: string) => void
  toggleToday: (habitId: string) => void
}

const HabitsContext = React.createContext<HabitsContextValue | null>(null)

export function useHabits() {
  const context = React.useContext(HabitsContext)
  if (!context) {
    throw new Error("useHabits must be used within a HabitsProvider.")
  }
  return context
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
    ]).then(([habitsRes, compRes]) => {
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
    })
    return () => {
      cancelled = true
    }
  }, [supabase, workspace])

  const value = React.useMemo<HabitsContextValue>(() => {
    return {
      habits,
      completions,
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
    }
  }, [habits, completions, loadError, supabase, userId, workspace])

  return (
    <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>
  )
}
