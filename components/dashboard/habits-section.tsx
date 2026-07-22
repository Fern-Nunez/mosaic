"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { useHabits } from "@/components/dashboard/habits-context"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { HABIT_ICONS, habitIcon } from "@/lib/habits"

export function HabitsSection() {
  const { habits, addHabit: addHabitToStore, removeHabit } = useHabits()

  const [name, setName] = React.useState("")
  const [iconKey, setIconKey] = React.useState(HABIT_ICONS[0].key)

  function addHabit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    addHabitToStore(trimmed, iconKey)
    setName("")
    setIconKey(HABIT_ICONS[0].key)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Add a habit</CardTitle>
          <CardDescription>
            Give it a name and pick an icon. It shows up as a dot in the top
            bar — tap it each day you do it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addHabit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="habit-name">Name</Label>
              <Input
                id="habit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Drink water"
              />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-8 gap-2 sm:grid-cols-10">
                {HABIT_ICONS.map(({ key, icon: Icon }) => {
                  const selected = key === iconKey
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={key}
                      aria-pressed={selected}
                      onClick={() => setIconKey(key)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md border transition-colors cursor-pointer",
                        selected
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-input bg-background text-muted-foreground hover:border-emerald-500/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                    </button>
                  )
                })}
              </div>
            </div>

            <Button type="submit" disabled={!name.trim()}>
              Add habit
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your habits</CardTitle>
          <CardDescription>
            {habits.length === 0
              ? "Nothing yet — add your first habit."
              : `${habits.length} ${habits.length === 1 ? "habit" : "habits"} tracked.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {habits.map((habit) => {
            const Icon = habitIcon(habit.icon)
            return (
              <div
                key={habit.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <span className="flex items-center gap-3 text-sm">
                  <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Icon className="size-4" />
                  </span>
                  {habit.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${habit.name}`}
                  onClick={() => removeHabit(habit.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
