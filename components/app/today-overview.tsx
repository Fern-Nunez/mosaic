"use client"

import * as React from "react"
import Link from "next/link"
import {
  Bike,
  BookOpen,
  Check,
  Dumbbell,
  Footprints,
  Moon,
  Scale,
  Utensils,
  Wallet,
  Waves,
  type LucideIcon,
} from "lucide-react"

import { usePrefs } from "@/components/app/prefs-context"
import { CaloriesRadial, MoneyBars, WeightLine } from "@/components/app/today-charts"
import { useHabits } from "@/components/dashboard/habits-context"
import { planLabel, workoutPlan, type SectionId } from "@/lib/app/prefs"
import { completedOn, dateKey, isDueOn, scheduleLabel } from "@/lib/habits"
import type {
  GymRow,
  JournalRow,
  NutritionRow,
  RunRow,
  SleepRow,
  TransactionRow,
  WeightRow,
} from "@/lib/types"
import { cn } from "@/lib/utils"

export type TodayData = {
  nutrition: Pick<NutritionRow, "id" | "date" | "meal_type" | "food_name" | "calories" | "protein">[]
  transactions: Pick<TransactionRow, "id" | "date" | "amount" | "transaction_type" | "description" | "category">[]
  gym: Pick<GymRow, "id" | "date" | "exercise" | "sets" | "reps" | "weight" | "unit">[]
  runs: RunRow[]
  cardio: { id: string; date: string; activity: "bike" | "swim"; distance: number | null; distance_unit: string | null; duration_seconds: number | null }[]
  sleep: Pick<SleepRow, "id" | "date" | "score" | "hours">[]
  journal: Pick<JournalRow, "id" | "date" | "title" | "mood">[]
  /** Up to 7 most recent weigh-ins, oldest first. */
  weights: Pick<WeightRow, "id" | "date" | "weight" | "unit">[]
  goals: { calories: number; protein: number }
}

// One color per category, used the same way everywhere.
const COLORS = {
  money: "#4E8A6B",
  nutrition: "#C9A24A",
  gym: "#6A7FB8",
  sleep: "#8A7BB8",
  weight: "#5A9E9A",
  journal: "#C8735F",
} as const

// Each card opens its full page under Trends.
const LINKS = {
  money: "/app/trends/money",
  nutrition: "/app/trends/nutrition",
  gym: "/app/trends/workout",
  sleep: "/app/trends/sleep",
  weight: "/app/trends/weight",
  journal: "/app/trends/journal",
  habits: "/app/trends/habits",
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

// The phone's own "today" (the server may be in another time zone).
// Re-checked every minute so it rolls over at midnight.
function subscribe(callback: () => void) {
  const id = window.setInterval(callback, 60_000)
  return () => window.clearInterval(id)
}
const getToday = () => dateKey(new Date())
const getServerToday = () => null

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number)
  return dateKey(new Date(y, m - 1, d + days))
}

function hoursLabel(hours: number) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <section className={cn("rounded-2xl bg-white dark:bg-neutral-900", className)}>{children}</section>
}

function SectionTitle({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
      <h2 className="text-[15px] text-neutral-900 dark:text-neutral-100">{title}</h2>
      {right && <span className="text-sm tabular-nums text-neutral-500 dark:text-neutral-400">{right}</span>}
    </div>
  )
}

function IconChip({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: `${color}1F`, color }}
    >
      <Icon className="size-4" strokeWidth={2} />
    </span>
  )
}

/* ---------------------------------------------------------------- Habits */

function HabitsCard({ today }: { today: string }) {
  const { habits: allHabits, completions, toggleToday, loadError } = useHabits()
  // Only what's due today (repeating tasks can be set to certain weekdays).
  const habits = allHabits.filter((h) => isDueOn(h, today))
  const done = new Set([...completedOn(completions, today)].filter((id) => habits.some((h) => h.id === id)))

  return (
    <Card>
      <SectionTitle
        title="Daily Habits"
        right={habits.length ? `${done.size}/${habits.length}` : undefined}
      />
      {loadError ? (
        <p className="px-4 pb-4 text-sm text-neutral-500 dark:text-neutral-400">Couldn&apos;t load habits.</p>
      ) : habits.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-neutral-500 dark:text-neutral-400">
          {allHabits.length ? "Nothing due today." : "No habits yet. Add a repeating task with + → Task."}
        </p>
      ) : (
        <ul className="pb-2">
          {habits.map((habit) => {
            const isDone = done.has(habit.id)
            return (
              <li key={habit.id} className="border-t border-neutral-100 dark:border-neutral-800 first:border-t-0">
                <button
                  type="button"
                  onClick={() => toggleToday(habit.id)}
                  aria-pressed={isDone}
                  className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 text-left active:bg-neutral-50 dark:active:bg-neutral-800"
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
                      isDone ? "border-[#4E8A6B] bg-[#4E8A6B] text-white" : "border-neutral-400 dark:border-neutral-600"
                    )}
                  >
                    {isDone && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span
                    className={cn(
                      "flex-1 text-[15px] transition-colors",
                      isDone ? "text-[#3F7458] dark:text-[#7FBF9A]" : "text-neutral-900 dark:text-neutral-100"
                    )}
                  >
                    {habit.name}
                  </span>
                  {habit.days && habit.days.length > 0 && habit.days.length < 7 && (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">{scheduleLabel(habit.days)}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* --------------------------------------------------------------- Numbers */

function StatCard({
  href,
  icon,
  color,
  label,
  value,
  hint,
}: {
  href: string
  icon: LucideIcon
  color: string
  label: string
  value: string
  hint: string
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[124px] flex-col gap-2 rounded-2xl bg-white dark:bg-neutral-900 p-4 active:bg-neutral-50 dark:active:bg-neutral-800"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{label}</span>
        <IconChip icon={icon} color={color} />
      </div>
      <span className="text-2xl font-medium tracking-tight tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</span>
    </Link>
  )
}

/* ------------------------------------------------------------------ Page */

export function TodayOverview({ data }: { data: TodayData }) {
  const today = React.useSyncExternalStore(subscribe, getToday, getServerToday)
  const { prefs } = usePrefs()
  const on = (id: SectionId) => !prefs.hiddenSections?.includes(id)

  // Before the phone's date is known, hold the space so nothing jumps.
  if (today === null) {
    return <div className="min-h-[60svh]" aria-busy="true" />
  }

  const isToday = (row: { date: string }) => row.date === today

  const meals = data.nutrition.filter(isToday)
  const calories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0)
  const protein = Math.round(meals.reduce((sum, m) => sum + (m.protein ?? 0), 0))

  const money = data.transactions.filter(isToday)
  // Money card covers the whole month on the phone's calendar.
  const thisMonth = data.transactions.filter((t) => t.date.slice(0, 7) === today.slice(0, 7))
  const monthIncome = thisMonth
    .filter((t) => t.transaction_type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const monthExpense = thisMonth
    .filter((t) => t.transaction_type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const monthName = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { month: "long" })

  const lifts = data.gym.filter(isToday)
  const exercises = [...new Set(lifts.map((l) => l.exercise))]
  const runs = data.runs.filter(isToday)
  const miles = runs.reduce((sum, r) => sum + Number(r.distance_miles), 0)
  const cardio = data.cardio.filter(isToday)
  // Rides and swims named the way they'll read in the card hint.
  const cardioNames = cardio.map((c) => (c.activity === "bike" ? "bike ride" : "swim"))

  // Last night = a sleep entry dated today, or failing that, yesterday.
  const sleep =
    data.sleep.find((s) => s.date === today) ??
    data.sleep.find((s) => s.date === shiftKey(today, -1)) ??
    null

  const journal = data.journal.filter(isToday)
  const weight = data.weights[data.weights.length - 1] ?? null
  const weightUnit = weight?.unit === "kg" ? "kg" : "lb"
  const weighedToday = weight?.date === today

  // What the workout plan in Settings says today should be.
  const planned = workoutPlan(prefs)?.[new Date(`${today}T12:00:00`).getDay()] ?? null
  const doneKinds = new Set([
    ...(exercises.length ? ["lift"] : []),
    ...(runs.length ? ["run"] : []),
    ...cardio.map((c) => c.activity),
  ])
  const stillToDo = planned ? planned.filter((k) => !doneKinds.has(k)) : []
  const sessions = exercises.length + runs.length + cardio.length
  const workoutValue =
    exercises.length > 0
      ? `${exercises.length} lift${exercises.length === 1 ? "" : "s"}`
      : sessions > 0
        ? `${sessions} session${sessions === 1 ? "" : "s"}`
        : planned?.length
          ? planLabel(planned)!
          : "Rest"
  const extras = [miles > 0 ? `${miles.toFixed(1)} mi run` : null, ...cardioNames].filter(Boolean)
  const loggedHint =
    exercises.length > 0 && extras.length
      ? `+ ${extras.join(", ")}`
      : exercises.length > 0
        ? exercises.slice(0, 2).join(", ") + (exercises.length > 2 ? "…" : "")
        : extras.length
          ? extras.join(", ")
          : null
  const workoutHint =
    sessions === 0
      ? planned === null
        ? "Nothing logged yet"
        : planned.length
          ? "Planned today · not logged yet"
          : "Rest day"
      : stillToDo.length
        ? `${loggedHint} · ${planLabel(stillToDo)} still to do`
        : (loggedHint ?? "")

  // Everything logged today, in one list.
  type Entry = { key: string; icon: LucideIcon; color: string; title: string; detail: string; href: string }
  const SECTION_OF: Record<string, SectionId> = { n: "nutrition", t: "money", g: "workout", r: "workout", c: "workout", j: "journal", w: "weight" }
  const allEntries: Entry[] = [
    ...meals.map((m) => ({
      key: `n-${m.id}`,
      icon: Utensils,
      color: COLORS.nutrition,
      title: m.food_name,
      detail: m.calories != null ? `${Math.round(m.calories)} cal` : (m.meal_type ?? ""),
      href: LINKS.nutrition,
    })),
    ...money.map((t) => ({
      key: `t-${t.id}`,
      icon: Wallet,
      color: COLORS.money,
      title: t.description || t.category || (t.transaction_type === "income" ? "Income" : "Expense"),
      detail: `${t.transaction_type === "income" ? "+" : "−"}${usd.format(Number(t.amount))}`,
      href: LINKS.money,
    })),
    ...exercises.map((name) => {
      const sets = lifts.filter((l) => l.exercise === name)
      const top = Math.max(...sets.map((s) => s.weight ?? 0))
      const unit = sets.find((s) => s.unit === "kg") ? "kg" : "lb"
      return {
        key: `g-${name}`,
        icon: Dumbbell,
        color: COLORS.gym,
        title: name,
        detail: `${sets.length} set${sets.length === 1 ? "" : "s"}${top > 0 ? ` · ${top} ${unit}` : ""}`,
        href: LINKS.gym,
      }
    }),
    ...runs.map((r) => ({
      key: `r-${r.id}`,
      icon: Footprints,
      color: COLORS.gym,
      title: "Run",
      detail: `${Number(r.distance_miles).toFixed(1)} mi`,
      href: LINKS.gym,
    })),
    ...cardio.map((c) => ({
      key: `c-${c.id}`,
      icon: c.activity === "bike" ? Bike : Waves,
      color: COLORS.gym,
      title: c.activity === "bike" ? "Bike ride" : "Swim",
      detail: [
        c.distance != null ? `${Number(c.distance)} ${c.distance_unit ?? ""}`.trim() : null,
        c.duration_seconds ? `${Math.round(c.duration_seconds / 60)} min` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: LINKS.gym,
    })),
    ...journal.map((j) => ({
      key: `j-${j.id}`,
      icon: BookOpen,
      color: COLORS.journal,
      title: j.title || "Journal entry",
      detail: j.mood && j.mood !== "unknown" ? j.mood[0].toUpperCase() + j.mood.slice(1) : "",
      href: LINKS.journal,
    })),
    ...(weighedToday && weight?.weight != null
      ? [
          {
            key: `w-${weight.id}`,
            icon: Scale,
            color: COLORS.weight,
            title: "Weigh-in",
            detail: `${weight.weight} ${weight.unit === "kg" ? "kg" : "lb"}`,
            href: LINKS.weight,
          },
        ]
      : []),
  ]

  const entries = allEntries.filter((e) => on(SECTION_OF[e.key.split("-")[0]]))

  return (
    <div className="flex flex-col gap-4">
      {on("habits") && <HabitsCard today={today} />}

      {on("nutrition") && (
      <CaloriesRadial
        href={LINKS.nutrition}
        calories={calories}
        goal={data.goals.calories}
        protein={protein}
        proteinGoal={data.goals.protein}
      />
      )}

      {/* An odd card out spans the full row. */}
      <div className="grid grid-cols-2 gap-3 empty:hidden [&>*:last-child:nth-child(odd)]:col-span-2">
        {on("workout") && (
        <StatCard
          href={LINKS.gym}
          icon={Dumbbell}
          color={COLORS.gym}
          label="Workout"
          value={workoutValue}
          hint={workoutHint}
        />
        )}
        {on("sleep") && (
        <StatCard
          href={LINKS.sleep}
          icon={Moon}
          color={COLORS.sleep}
          label="Sleep"
          value={sleep?.hours != null ? hoursLabel(Number(sleep.hours)) : "—"}
          hint={sleep ? (sleep.score != null ? `Score ${sleep.score} · last night` : "Last night") : "Not logged"}
        />
        )}
      </div>

      {on("money") && <MoneyBars href={LINKS.money} month={monthName} income={monthIncome} expense={monthExpense} />}

      {on("weight") && (
      <WeightLine
        href={LINKS.weight}
        unit={weightUnit}
        points={data.weights
          .filter((w) => w.weight != null)
          .map((w) => ({ date: w.date, weight: Number(w.weight) }))}
      />
      )}

      <Card>
        <SectionTitle title="Logged today" right={entries.length ? String(entries.length) : undefined} />
        {entries.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Nothing logged yet today. Tap + to start.
          </p>
        ) : (
          <ul className="pb-2">
            {entries.map((entry) => (
              <li key={entry.key} className="border-t border-neutral-100 dark:border-neutral-800 first:border-t-0">
                <Link
                  href={entry.href}
                  className="flex min-h-12 items-center gap-3 px-4 py-2 active:bg-neutral-50 dark:active:bg-neutral-800"
                >
                  <IconChip icon={entry.icon} color={entry.color} />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-neutral-900 dark:text-neutral-100">
                    {entry.title}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-neutral-500 dark:text-neutral-400">
                    {entry.detail}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
