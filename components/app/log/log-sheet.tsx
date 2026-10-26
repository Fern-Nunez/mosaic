"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  JournalForm,
  MoneyForm,
  NotesForm,
  NutritionForm,
  SleepForm,
  SupplementForm,
  TaskForm,
  WeightForm,
  WorkoutForm,
  type LogContext,
} from "@/components/app/log/forms"
import { QUICK_ACTIONS, type LoggerId } from "@/components/app/quick-actions"
import { useToday } from "@/components/app/use-today"
import { useWorkspace } from "@/components/dashboard/workspace-context"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"

const FORMS: Record<LoggerId, React.ComponentType<{ ctx: LogContext }>> = {
  money: MoneyForm,
  workout: WorkoutForm,
  journal: JournalForm,
  sleep: SleepForm,
  weight: WeightForm,
  notes: NotesForm,
  nutrition: NutritionForm,
  supplement: SupplementForm,
  task: TaskForm,
}

/** Bottom sheet holding whichever logger was picked from the + menu. */
export function LogSheet({
  logger,
  userId,
  mealPhoto,
  onClose,
}: {
  logger: LoggerId | null
  userId: string
  mealPhoto: File | null
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const { active } = useWorkspace()
  const today = useToday()
  const sheetRef = React.useRef<HTMLDivElement>(null)
  // Keep showing the last form while the sheet animates closed.
  const [shown, setShown] = React.useState<LoggerId | null>(logger)
  if (logger && logger !== shown) setShown(logger)

  const action = QUICK_ACTIONS.find((a) => a.id === shown)
  const Form = shown ? FORMS[shown] : null

  const ctx: LogContext | null = today
    ? {
        supabase,
        userId,
        workspace: active.id,
        today,
        mealPhoto,
        done: () => {
          onClose()
          // Re-run the server components so Today and Trends show the new entry.
          router.refresh()
        },
      }
    : null

  return (
    <Sheet open={logger !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        // Focus the sheet itself, not the first field, so the keyboard
        // doesn't jump up before you've decided what to tap.
        initialFocus={sheetRef}
        ref={sheetRef}
        tabIndex={-1}
        className="mx-auto max-h-[92svh] max-w-[440px] gap-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-3xl border-0 bg-white px-5 pt-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        {action && (
          <div className="mb-5 flex items-center gap-3 pr-10">
            <action.icon className="size-5 text-[#318E63]" />
            <SheetTitle className="text-lg font-semibold">{action.title}</SheetTitle>
            <SheetDescription className="sr-only">Fill in the details and save.</SheetDescription>
          </div>
        )}
        {/* Keyed so each open starts with a fresh, empty form. */}
        {Form && ctx && <Form key={`${shown}-${logger === null ? "closed" : "open"}`} ctx={ctx} />}
      </SheetContent>
    </Sheet>
  )
}
