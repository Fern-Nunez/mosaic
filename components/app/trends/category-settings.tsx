"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Settings2, X } from "lucide-react"

import {
  Choice,
  ErrorText,
  Field,
  FieldGroup,
  NumberInput,
  SaveButton,
  toNumber,
} from "@/components/app/log/fields"
import { CATEGORY_META } from "@/components/app/trends/meta"
import { useHabits } from "@/components/dashboard/habits-context"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_SLEEP_GOAL,
  planLabel,
  WORKOUT_KINDS,
  workoutPlan,
  type WorkoutKind,
} from "@/lib/app/prefs"
import { savePrefs } from "@/lib/app/save-prefs"
import type { TrendCategory, TrendData } from "@/lib/app/trend-data"
import { scheduleLabel, WEEKDAY_SHORT } from "@/lib/habits"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type SettingsData = Pick<TrendData, "prefs" | "prefsReady" | "goals" | "estimateLevel" | "stack">

type FormProps = {
  data: SettingsData
  userId: string
  done: () => void
}

/** Gear button in the top-right of a category page; opens its settings. */
export function CategorySettings({
  category,
  data,
  userId,
}: {
  category: TrendCategory
  data: SettingsData
  userId: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [session, setSession] = React.useState(0)
  const sheetRef = React.useRef<HTMLDivElement>(null)
  const meta = CATEGORY_META[category]
  const Form = FORMS[category]

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSession((n) => n + 1)
          setOpen(true)
        }}
        aria-label={`${meta.title} settings`}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm active:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-300 dark:active:bg-neutral-800"
      >
        <Settings2 className="size-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          initialFocus={sheetRef}
          ref={sheetRef}
          tabIndex={-1}
          className="mx-auto max-h-[92svh] max-w-[440px] gap-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-3xl border-0 bg-white px-5 pt-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        >
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          <div className="mb-5 flex items-center gap-3 pr-10">
            <Settings2 className="size-5 text-[#318E63]" />
            <SheetTitle className="text-lg font-semibold">{meta.title} settings</SheetTitle>
            <SheetDescription className="sr-only">Change how this page works.</SheetDescription>
          </div>
          {/* Keyed so each open starts from the saved values. */}
          <Form
            key={session}
            data={data}
            userId={userId}
            done={() => {
              setOpen(false)
              router.refresh()
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

/* ------------------------------------------------------------- helpers */

function useSubmit(done: () => void) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  async function run(save: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    const err = await save()
    setBusy(false)
    if (err) return setError(err)
    done()
  }
  return { busy, error, setError, run }
}

function NotReady() {
  return (
    <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      These settings need the settings SQL run in Supabase before they&apos;ll save.
    </p>
  )
}

const str = (v: number | null | undefined) => (v == null ? "" : String(v))

/* --------------------------------------------------------------- forms */

function MoneySettings({ data, userId, done }: FormProps) {
  const [budget, setBudget] = React.useState(str(data.prefs.moneyBudget))
  const { busy, error, setError, run } = useSubmit(done)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const value = toNumber(budget)
        if (value !== null && value <= 0) return setError("Budget should be more than $0.")
        run(() => savePrefs(userId, { moneyBudget: value }))
      }}
    >
      {!data.prefsReady && <NotReady />}
      <Field label="Monthly spending budget" hint="leave empty for none">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-neutral-500">$</span>
          <NumberInput value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="2,000" className="pl-8" />
        </div>
      </Field>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Shows how much of it you&apos;ve used. Scales with the range: one month for M, three for Q, twelve for Y.
      </p>
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy} />
    </form>
  )
}

function NutritionSettings({ data, userId, done }: FormProps) {
  const [goals, setGoals] = React.useState({
    calories: str(data.goals.calories),
    protein: str(data.goals.protein),
    carbs: str(data.goals.carbs),
    fat: str(data.goals.fat),
    fiber: str(data.goals.fiber),
  })
  const [level, setLevel] = React.useState(data.estimateLevel)
  const { busy, error, setError, run } = useSubmit(done)
  const set = (key: keyof typeof goals) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setGoals((g) => ({ ...g, [key]: e.target.value }))

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const n = Object.fromEntries(Object.entries(goals).map(([k, v]) => [k, toNumber(v)])) as Record<keyof typeof goals, number | null>
        if (Object.values(n).some((v) => v === null || v <= 0)) return setError("Fill in every goal with a number above 0.")
        run(async () => {
          const { error: err } = await createClient()
            .from("user_settings")
            .upsert(
              {
                user_id: userId,
                calorie_goal: Math.round(n.calories!),
                protein_goal: Math.round(n.protein!),
                carb_goal: Math.round(n.carbs!),
                fat_goal: Math.round(n.fat!),
                fiber_goal: Math.round(n.fiber!),
                estimate_level: level,
              },
              { onConflict: "user_id" }
            )
          return err?.message ?? null
        })
      }}
    >
      <span className="text-sm font-medium">Daily goals</span>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories"><NumberInput value={goals.calories} onChange={set("calories")} inputMode="numeric" /></Field>
        <Field label="Protein" hint="g"><NumberInput value={goals.protein} onChange={set("protein")} inputMode="numeric" /></Field>
        <Field label="Carbs" hint="g"><NumberInput value={goals.carbs} onChange={set("carbs")} inputMode="numeric" /></Field>
        <Field label="Fat" hint="g"><NumberInput value={goals.fat} onChange={set("fat")} inputMode="numeric" /></Field>
        <Field label="Fiber" hint="g"><NumberInput value={goals.fiber} onChange={set("fiber")} inputMode="numeric" /></Field>
      </div>
      <FieldGroup label="Photo calorie estimates">
        <Choice
          options={[
            { value: "low", label: "Lower" },
            { value: "middle", label: "Middle" },
            { value: "high", label: "Higher" },
          ]}
          value={level}
          onChange={setLevel}
        />
      </FieldGroup>
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy} />
    </form>
  )
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/** Pick what each weekday is for. Nothing picked = rest day. */
function WorkoutSettings({ data, userId, done }: FormProps) {
  const [plan, setPlan] = React.useState<WorkoutKind[][]>(
    () => workoutPlan(data.prefs) ?? Array.from({ length: 7 }, () => [])
  )
  const { busy, error, run } = useSubmit(done)
  const trainingDays = plan.filter((d) => d.length).length

  function toggle(day: number, kind: WorkoutKind) {
    setPlan((p) =>
      p.map((kinds, i) =>
        i !== day
          ? kinds
          : kinds.includes(kind)
            ? kinds.filter((k) => k !== kind)
            : WORKOUT_KINDS.map((w) => w.id).filter((k) => k === kind || kinds.includes(k))
      )
    )
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        // An all-rest plan clears it (and the old days-per-week goal too).
        run(() => savePrefs(userId, { workoutPlan: trainingDays ? plan : null, workoutDaysPerWeek: null }))
      }}
    >
      {!data.prefsReady && <NotReady />}
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Weekly plan</span>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {trainingDays ? `${trainingDays} day${trainingDays === 1 ? "" : "s"} a week` : "No plan"}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {plan.map((kinds, day) => (
          <li key={day} className="flex flex-col gap-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-medium">{DAY_NAMES[day]}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{planLabel(kinds) ?? "Rest"}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`${DAY_NAMES[day]} workouts`}>
              {WORKOUT_KINDS.map((w) => {
                const picked = kinds.includes(w.id)
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggle(day, w.id)}
                    aria-pressed={picked}
                    className={cn(
                      "h-9 cursor-pointer rounded-full text-sm font-medium transition-colors",
                      picked
                        ? "bg-[#318E63] text-white"
                        : "bg-white text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
                    )}
                  >
                    {w.label}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Pick more than one for a double day. Leave a day empty for rest. Today and this page check your logs against it.
      </p>
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy} />
    </form>
  )
}

function WeightSettings({ data, userId, done }: FormProps) {
  const [goal, setGoal] = React.useState(str(data.prefs.weightGoal))
  const { busy, error, setError, run } = useSubmit(done)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const value = toNumber(goal)
        if (value !== null && value <= 0) return setError("Enter a weight above 0.")
        run(() => savePrefs(userId, { weightGoal: value }))
      }}
    >
      {!data.prefsReady && <NotReady />}
      <Field label="Goal weight" hint="same unit you log in · empty for none">
        <NumberInput value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="165" />
      </Field>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Adds a goal line to your weight chart and shows how far you have to go.</p>
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy} />
    </form>
  )
}

function SleepSettings({ data, userId, done }: FormProps) {
  const [hours, setHours] = React.useState(str(data.prefs.sleepGoalHours ?? DEFAULT_SLEEP_GOAL))
  const { busy, error, setError, run } = useSubmit(done)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const value = toNumber(hours)
        if (value === null || value <= 0 || value > 14) return setError("Pick a goal between 1 and 14 hours.")
        run(() => savePrefs(userId, { sleepGoalHours: value }))
      }}
    >
      {!data.prefsReady && <NotReady />}
      <Field label="Sleep goal" hint="hours per night">
        <NumberInput value={hours} onChange={(e) => setHours(e.target.value)} placeholder="7.5" />
      </Field>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Used for the goal line and the &ldquo;under goal&rdquo; count.</p>
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy} />
    </form>
  )
}

function JournalSettings({ data, userId, done }: FormProps) {
  const [hide, setHide] = React.useState(!!data.prefs.journalHideText)
  const { busy, error, run } = useSubmit(done)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => savePrefs(userId, { journalHideText: hide }))
      }}
    >
      {!data.prefsReady && <NotReady />}
      <label className="flex min-h-12 items-center gap-3 rounded-xl bg-neutral-100 px-4 dark:bg-neutral-800">
        <span className="flex-1 text-[15px]">
          Hide entry text
          <span className="block text-sm text-neutral-500 dark:text-neutral-400">Only titles and moods show in the list</span>
        </span>
        <Switch checked={hide} onCheckedChange={setHide} className="data-checked:bg-[#318E63]" />
      </label>
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy} />
    </form>
  )
}

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"]

/** Change which days each habit is due, or remove it. Saves as you tap. */
function HabitsSettings({ done }: FormProps) {
  const { habits, setHabitDays, removeHabit } = useHabits()
  const [error, setError] = React.useState<string | null>(null)

  async function toggle(id: string, current: number[] | null | undefined, day: number) {
    const all = current && current.length ? current : [0, 1, 2, 3, 4, 5, 6]
    const next = all.includes(day) ? all.filter((d) => d !== day) : [...all, day].sort()
    if (next.length === 0) return setError("A habit needs at least one day. Remove it instead.")
    setError(null)
    const err = await setHabitDays(id, next.length === 7 ? null : next)
    if (err) setError(err)
  }

  return (
    <div className="flex flex-col gap-4">
      {habits.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No habits yet. Add a repeating task with + → Task.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {habits.map((h) => {
            const on = h.days && h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6]
            return (
              <li key={h.id} className="flex flex-col gap-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{h.name}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">{scheduleLabel(h.days)}</span>
                  <button
                    type="button"
                    onClick={() => removeHabit(h.id)}
                    aria-label={`Remove ${h.name}`}
                    className="-mr-1 flex size-8 cursor-pointer items-center justify-center rounded-full text-neutral-400 active:bg-neutral-200 dark:active:bg-neutral-700"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex justify-between gap-1">
                  {LETTERS.map((l, d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggle(h.id, h.days, d)}
                      aria-pressed={on.includes(d)}
                      aria-label={`${h.name} on ${WEEKDAY_SHORT[d]}`}
                      className={cn(
                        "flex size-9 cursor-pointer items-center justify-center rounded-full text-sm font-medium",
                        on.includes(d) ? "bg-[#318E63] text-white" : "bg-white text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <ErrorText>{error}</ErrorText>
      <button type="button" onClick={done} className="h-12 cursor-pointer rounded-xl bg-neutral-100 text-base dark:bg-neutral-800">
        Done
      </button>
    </div>
  )
}

/**
 * Which days you take each supplement (saves as you tap), and "Stop taking"
 * (it leaves the stack; history stays). Off-days move it to "Not scheduled
 * today" in the logger instead of your daily list.
 */
function SupplementsSettings({ data, userId, done }: FormProps) {
  const [stack, setStack] = React.useState(data.stack)
  const [schedule, setSchedule] = React.useState<Record<string, number[]>>(data.prefs.supplementDays ?? {})
  const [error, setError] = React.useState<string | null>(null)

  async function stop(id: string) {
    const prev = stack
    setStack((s) => s.filter((x) => x.id !== id))
    const { error: err } = await createClient().from("supplements").update({ is_active: false }).eq("id", id)
    if (err) {
      setStack(prev)
      setError(err.message)
    }
  }

  async function toggleDay(id: string, day: number) {
    const current = schedule[id]?.length ? schedule[id] : [0, 1, 2, 3, 4, 5, 6]
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()
    if (next.length === 0) return setError("Pick at least one day, or use Stop taking.")
    setError(null)
    const prev = schedule
    const updated = { ...schedule }
    if (next.length === 7) delete updated[id]
    else updated[id] = next
    setSchedule(updated)
    const err = await savePrefs(userId, { supplementDays: updated })
    if (err) {
      setSchedule(prev)
      setError(err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!data.prefsReady && <NotReady />}
      {stack.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Your stack is empty. Log a supplement with + to add one.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {stack.map((s) => {
            const on = schedule[s.id]?.length ? schedule[s.id] : [0, 1, 2, 3, 4, 5, 6]
            return (
              <li key={s.id} className="flex flex-col gap-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{s.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {[s.dose != null ? `${s.dose} ${s.unit ?? ""}`.trim() : null, scheduleLabel(on)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => stop(s.id)}
                    className="h-8 shrink-0 cursor-pointer rounded-full bg-white px-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                  >
                    Stop taking
                  </button>
                </div>
                <div className="flex justify-between gap-1">
                  {LETTERS.map((l, d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(s.id, d)}
                      aria-pressed={on.includes(d)}
                      aria-label={`${s.name} on ${WEEKDAY_SHORT[d]}`}
                      className={cn(
                        "flex size-9 cursor-pointer items-center justify-center rounded-full text-sm font-medium",
                        on.includes(d) ? "bg-[#C27A98] text-white" : "bg-white text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Tap days to set when you take each one. On other days it moves to &ldquo;Not scheduled today&rdquo; so it isn&apos;t
        logged by accident. Stopping keeps your history.
      </p>
      <ErrorText>{error}</ErrorText>
      <button type="button" onClick={done} className="h-12 cursor-pointer rounded-xl bg-neutral-100 text-base dark:bg-neutral-800">
        Done
      </button>
    </div>
  )
}

const FORMS: Record<TrendCategory, React.ComponentType<FormProps>> = {
  money: MoneySettings,
  nutrition: NutritionSettings,
  workout: WorkoutSettings,
  weight: WeightSettings,
  sleep: SleepSettings,
  journal: JournalSettings,
  habits: HabitsSettings,
  supplements: SupplementsSettings,
}
