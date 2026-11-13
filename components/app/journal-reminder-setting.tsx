"use client"

import { BookOpen, Pill, Scale } from "lucide-react"

import { TimedReminderSetting } from "@/components/app/timed-reminder-setting"
import { timeLabel } from "@/components/app/time-wheels"

/* The reminders that are off until you pick a time. Sent by /api/reminders/timed. */

export function JournalReminderSetting() {
  return (
    <TimedReminderSetting
      icon={BookOpen}
      label="Journal reminder"
      prefKey="journalReminderTime"
      defaultTime="21:00"
      note={(t) => `Every day at ${timeLabel(t)}, unless you've already written.`}
    />
  )
}

export function SupplementReminderSetting() {
  return (
    <TimedReminderSetting
      icon={Pill}
      label="Supplement reminder"
      prefKey="supplementReminderTime"
      defaultTime="08:00"
      note={(t) => `At ${timeLabel(t)} on days something in your stack is due and not taken yet.`}
    />
  )
}

export function WeightReminderSetting() {
  return (
    <TimedReminderSetting
      icon={Scale}
      label="Weight reminder"
      prefKey="weightReminderTime"
      defaultTime="07:00"
      note={(t) => `Every day at ${timeLabel(t)}, unless you've already weighed in.`}
    />
  )
}
