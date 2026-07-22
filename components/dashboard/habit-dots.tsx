"use client"

import { useHabits } from "@/components/dashboard/habits-context"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { completedOn, dateKey, habitIcon } from "@/lib/habits"

export function HabitDots() {
  const { habits, completions, toggleToday } = useHabits()

  const doneToday = completedOn(completions, dateKey(new Date()))

  if (habits.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        {habits.map((habit) => {
          const done = doneToday.has(habit.id)
          const Icon = habitIcon(habit.icon)
          return (
            <Tooltip key={habit.id}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => toggleToday(habit.id)}
                    aria-pressed={done}
                    aria-label={`${done ? "Undo" : "Complete"} ${habit.name}`}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border transition-all duration-200 cursor-pointer",
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_10px_1px] shadow-emerald-500/70"
                        : "border-muted-foreground/40 bg-transparent text-muted-foreground hover:border-emerald-500/60 hover:text-emerald-600"
                    )}
                  >
                    <Icon className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent>{habit.name}</TooltipContent>
            </Tooltip>
          )
        })}
      </TooltipProvider>
    </div>
  )
}
