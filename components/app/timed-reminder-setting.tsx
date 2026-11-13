"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"

import { usePrefs } from "@/components/app/prefs-context"
import { Reveal } from "@/components/app/reveal"
import { TimeWheels, timeLabel } from "@/components/app/time-wheels"
import { Switch } from "@/components/ui/switch"
import type { AppPrefs } from "@/lib/app/prefs"
import { savePrefs } from "@/lib/app/save-prefs"

type TimeKey = "journalReminderTime" | "supplementReminderTime" | "weightReminderTime"

/**
 * A reminder that's off until you pick a time: a switch, and dials that
 * open under the row. Off saves null; the time row is tappable to change it.
 */
export function TimedReminderSetting({
  icon: Icon,
  label,
  prefKey,
  defaultTime,
  note,
}: {
  icon: LucideIcon
  label: string
  prefKey: TimeKey
  defaultTime: string
  /** The line under the row once it's on, e.g. "Every day at 9:00 PM…". */
  note: (time: string) => string
}) {
  const router = useRouter()
  const { prefs, userId } = usePrefs()
  const [time, setTime] = React.useState<string | null>(prefs[prefKey] ?? null)
  const [picking, setPicking] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // Last saved time, so the note can still say it while it animates away.
  const [lastTime, setLastTime] = React.useState(time ?? defaultTime)
  if (time !== null && time !== lastTime) setLastTime(time)

  async function save(next: string | null) {
    const prev = time
    setTime(next)
    setError(null)
    const err = await savePrefs(userId, { [prefKey]: next } as AppPrefs)
    if (err) {
      setTime(prev)
      return setError(err)
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col px-4 py-1.5">
      <div className="flex min-h-11 items-center gap-3 text-[15px] text-neutral-900 dark:text-neutral-100">
        <Icon className="size-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
        <span className="flex-1">{label}</span>
        {time && !picking && (
          <button type="button" onClick={() => setPicking(true)} className="cursor-pointer text-[15px] text-neutral-500 dark:text-neutral-400">
            {timeLabel(time)}
          </button>
        )}
        <Switch
          checked={time !== null || picking}
          onCheckedChange={(v) => {
            setPicking(v)
            if (!v && time !== null) save(null)
          }}
          className="data-checked:bg-[#318E63]"
        />
      </div>
      <Reveal open={picking}>
        <TimeWheels
          initial={time ?? defaultTime}
          onDone={(t) => {
            setPicking(false)
            if (t !== time) save(t)
          }}
        />
      </Reveal>
      <Reveal open={time !== null && !picking}>
        <p className="pb-1.5 pl-8 text-xs text-neutral-500 dark:text-neutral-400">{note(lastTime)} Tap the time to change it.</p>
      </Reveal>
      {error && <p className="pb-1.5 pl-8 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
