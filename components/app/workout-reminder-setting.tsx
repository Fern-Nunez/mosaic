"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Dumbbell } from "lucide-react"

import { usePrefs } from "@/components/app/prefs-context"
import { Reveal } from "@/components/app/reveal"
import { TimeWheels, timeLabel } from "@/components/app/time-wheels"
import { Switch } from "@/components/ui/switch"
import { DEFAULT_WORKOUT_REMINDER_TIME } from "@/lib/app/prefs"
import { savePrefs } from "@/lib/app/save-prefs"

/**
 * More → Workout reminder. On by default at 6:00 PM. A switch, and dials
 * that open under the row to change the time. The push only goes out when
 * a workout is planned that day and not logged yet.
 */
export function WorkoutReminderSetting() {
  const router = useRouter()
  const { prefs, userId } = usePrefs()
  const [on, setOn] = React.useState(prefs.workoutReminder !== false)
  const [time, setTime] = React.useState(prefs.workoutReminderTime ?? DEFAULT_WORKOUT_REMINDER_TIME)
  const [picking, setPicking] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function save(patch: { workoutReminder?: boolean; workoutReminderTime?: string }, undo: () => void) {
    setError(null)
    const err = await savePrefs(userId, patch)
    if (err) {
      undo()
      return setError(err)
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col px-4 py-1.5">
      <div className="flex min-h-11 items-center gap-3 text-[15px] text-neutral-900 dark:text-neutral-100">
        <Dumbbell className="size-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
        <span className="flex-1">Workout reminder</span>
        {on && !picking && (
          <button type="button" onClick={() => setPicking(true)} className="cursor-pointer text-[15px] text-neutral-500 dark:text-neutral-400">
            {timeLabel(time)}
          </button>
        )}
        <Switch
          checked={on}
          onCheckedChange={(v) => {
            setOn(v)
            setPicking(v)
            save({ workoutReminder: v }, () => setOn(!v))
          }}
          className="data-checked:bg-[#318E63]"
        />
      </div>
      <Reveal open={picking}>
        <TimeWheels
          initial={time}
          onDone={(t) => {
            setPicking(false)
            if (t === time) return
            const prev = time
            setTime(t)
            save({ workoutReminderTime: t }, () => setTime(prev))
          }}
        />
      </Reveal>
      <Reveal open={on && !picking}>
        <p className="pb-1.5 pl-8 text-xs text-neutral-500 dark:text-neutral-400">
          At {timeLabel(time)} if a planned workout isn&apos;t logged yet. Tap the time to change it.
        </p>
      </Reveal>
      {error && <p className="pb-1.5 pl-8 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
