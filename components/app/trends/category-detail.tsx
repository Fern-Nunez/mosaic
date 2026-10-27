"use client"

import * as React from "react"
import { Check, Dumbbell, Footprints, type LucideIcon } from "lucide-react"

import { CATEGORY_META } from "@/components/app/trends/meta"
import { RangePicker } from "@/components/app/trends/range-picker"
import {
  BreakdownBars,
  BucketLine,
  ColumnChart,
  DayGrid,
  EntryList,
  GoalRings,
  IncomeRadial,
  Panel,
  PointLine,
  StatGrid,
} from "@/components/app/trends/detail-parts"
import { TransactionEditor } from "@/components/app/trends/transaction-editor"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToday } from "@/components/app/use-today"
import { useHabits } from "@/components/dashboard/habits-context"
import { inRange, keyToDate, monthsBetween, periodStart, shiftKey, type Range } from "@/lib/app/dates"
import { categoryColor, incomeTotal, isMoneyIn, netSpent, spentByCategory, transactionIcon, TX_LABEL } from "@/lib/app/money"
import {
  distinctDays,
  habitRate,
  hoursLabel,
  makeWindow,
  perBucket,
  sum,
  summarize,
  topCount,
  usd,
  usdCents,
  workoutDays,
  type HabitsInput,
  type Window,
} from "@/lib/app/metrics"
import type { TrendCategory, TrendData } from "@/lib/app/trend-data"
import { isDueOn, scheduleLabel } from "@/lib/habits"
import { DEFAULT_SLEEP_GOAL, planLabel, weeklyWorkoutGoal, workoutPlan, type WorkoutKind, supplementSchedule } from "@/lib/app/prefs"
import { CARDIO, type CardioActivity } from "@/lib/app/workouts"
import { cn } from "@/lib/utils"

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function CategoryDetail({
  category,
  data,
  range,
  keep,
}: {
  category: TrendCategory
  data: TrendData
  range: Range
  /** Extra query kept when switching range (e.g. "from=today" for the back link). */
  keep?: string
}) {
  const today = useToday()
  const { habits, completions } = useHabits()
  const meta = CATEGORY_META[category]

  if (today === null) return <div className="min-h-[60svh]" aria-busy="true" />

  const w = makeWindow(today, range)
  const habitsInput = { habits, completions }
  const s = summarize(category, data, w, habitsInput)
  const rangeLabel = range.title

  return (
    <div className="flex flex-col gap-4">
      <RangePicker active={range.id} keep={keep} />

      {/* Headline: the same number the Trends card shows. Money skips it;
          its half-ring already says what came in, went out and is left. */}
      {category !== "money" && (
      <Panel>
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${meta.color}1F`, color: meta.color }}
          >
            <meta.icon className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-medium tracking-tight tabular-nums text-neutral-900 dark:text-neutral-100">
              {s.value}
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{s.sub}</p>
          </div>
          {s.side && (
            <div className="shrink-0 text-left">
              <p className="text-3xl font-medium tracking-tight tabular-nums text-neutral-900 dark:text-neutral-100">{s.side.value}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{s.side.label}</p>
            </div>
          )}
        </div>
        {s.change && <p className="text-sm text-neutral-500 dark:text-neutral-400">{s.change}</p>}
      </Panel>
      )}

      {category === "money" && <MoneyDetail data={data} w={w} rangeLabel={rangeLabel} />}
      {category === "nutrition" && <NutritionDetail data={data} w={w} rangeLabel={rangeLabel} />}
      {category === "workout" && <WorkoutDetail data={data} w={w} rangeLabel={rangeLabel} />}
      {category === "weight" && <WeightDetail data={data} w={w} rangeLabel={rangeLabel} />}
      {category === "sleep" && <SleepDetail data={data} w={w} rangeLabel={rangeLabel} />}
      {category === "journal" && <JournalDetail data={data} w={w} rangeLabel={rangeLabel} />}
      {category === "habits" && <HabitsDetail input={habitsInput} w={w} rangeLabel={rangeLabel} />}
      {category === "supplements" && <SupplementsDetail data={data} w={w} rangeLabel={rangeLabel} />}
    </div>
  )
}

type DetailProps = { data: TrendData; w: Window; rangeLabel: string }

const inWindow = (w: Window) => (r: { date: string }) => inRange(r.date, w.start, w.today)
const per = (w: Window) => ({ d: "today", m: "per day", q: "per week", y: "per month" })[w.range.id]
/** Calendars shown for the day squares: this month for D/M, else the whole period. */
const calendarMonths = (w: Window) =>
  monthsBetween(w.range.id === "d" ? periodStart(w.today, "m") : w.start, w.today)

/* ----------------------------------------------------------------- Money */

function MoneyDetail({ data, w, rangeLabel }: DetailProps) {
  const rows = data.transactions.filter(inWindow(w))
  // Paid-back money (Zelle etc.) lowers spending in its category; it isn't income.
  const income = incomeTotal(rows)
  const spent = netSpent(rows)
  const saved = income - spent
  const paidBack = sum(rows.filter((t) => t.transaction_type === "reimbursement"), (t) => t.amount)

  const categories = [...spentByCategory(rows).entries()]
    .map(([label, value]) => ({ label, value: Math.round(value), color: categoryColor(label) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  return (
    <>
      <Panel title="Made vs. spent" subtitle={rangeLabel}>
        <IncomeRadial income={income} spent={spent} format={(v) => usd.format(v)} />
        {paidBack > 0 && (
          <p className="-mt-1 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Spent is after {usd.format(paidBack)} paid back.
          </p>
        )}
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          {income === 0
            ? "No income logged in this range."
            : saved >= 0
              ? `You kept ${Math.round((saved / income) * 100)}% of what you made.`
              : `You spent ${usd.format(Math.abs(saved))} more than you made.`}
        </p>
      </Panel>
      {data.prefs.moneyBudget ? <BudgetPanel monthly={data.prefs.moneyBudget} spent={spent} w={w} /> : null}
      {categories.length > 0 && (
        <Panel title="Where it went" subtitle="Spending by category">
          <BreakdownBars rows={categories} color="#C8735F" format={(v) => usd.format(v)} />
        </Panel>
      )}
      <TransactionList rows={rows} />
    </>
  )
}

/** Scrollable list: icon, what it was, category and date, amount. Tap one to edit or delete it. */
function TransactionList({ rows }: { rows: TrendData["transactions"] }) {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const [editing, setEditing] = React.useState<TrendData["transactions"][number] | null>(null)
  return (
    <Panel title="Transactions" subtitle={`${rows.length} in this range · tap one to edit`}>
      <TransactionEditor transaction={editing} onClose={() => setEditing(null)} />
      {sorted.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No transactions in this range.</p>
      ) : (
        // Bleeds into the card's padding so rows use nearly the full width.
        <ScrollArea className="-mx-5 h-[440px]">
          <ul className="px-3">
            {sorted.map((t) => {
              const color =
                t.transaction_type === "income" ? categoryColor("Income") : t.transaction_type === "reimbursement" ? categoryColor("Paid back") : categoryColor(t.category)
              const Icon = transactionIcon(t)
              return (
                <li key={t.id} className="border-t border-neutral-100 first:border-t-0 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    className="-mx-2 flex min-h-16 w-[calc(100%+1rem)] cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left active:bg-neutral-50 dark:active:bg-neutral-800"
                  >
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${color}1F`, color }}
                  >
                    <Icon className="size-[18px]" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-neutral-900 dark:text-neutral-100">
                      {t.description || t.category || TX_LABEL[t.transaction_type]}
                    </p>
                    <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                      {t.transaction_type === "income"
                        ? "Income"
                        : t.transaction_type === "reimbursement"
                          ? `Paid back${t.category ? ` · ${t.category}` : ""}`
                          : t.category || "Other"}{" "}
                      ·{" "}
                      {keyToDate(t.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[15px] font-medium tabular-nums",
                      isMoneyIn(t) ? "text-[#3F7458] dark:text-[#7FBF9A]" : "text-neutral-900 dark:text-neutral-100"
                    )}
                  >
                    {isMoneyIn(t) ? "+" : "−"}
                    {usdCents.format(t.amount)}
                  </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------- Nutrition */

type MacroKey = "calories" | "protein" | "carbs" | "fat" | "fiber"

function NutritionDetail({ data, w, rangeLabel }: DetailProps) {
  const [macro, setMacro] = React.useState<MacroKey>("calories")
  const rows = data.nutrition.filter(inWindow(w))
  const days = distinctDays(rows)

  const MACROS: { key: MacroKey; label: string; unit: string; color: string; goal: number }[] = [
    { key: "calories", label: "Calories", unit: "", color: "#C9A24A", goal: data.goals.calories },
    { key: "protein", label: "Protein", unit: "g", color: "#C8735F", goal: data.goals.protein },
    { key: "carbs", label: "Carbs", unit: "g", color: "#6A9AB8", goal: data.goals.carbs },
    { key: "fat", label: "Fat", unit: "g", color: "#9C7BB0", goal: data.goals.fat },
    { key: "fiber", label: "Fiber", unit: "g", color: "#6F9A5B", goal: data.goals.fiber },
  ]
  const selected = MACROS.find((m) => m.key === macro)!
  /** Average per day that has any meal logged; NaN when nothing was logged. */
  const avgPerDay = (r: TrendData["nutrition"], key: MacroKey) => {
    const d = distinctDays(r)
    return d ? sum(r, (n) => n[key]) / d : NaN
  }

  const foods = new Map<string, number>()
  for (const n of rows) foods.set(n.food_name, (foods.get(n.food_name) ?? 0) + 1)
  const topFoods = [...foods.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  return (
    <>
      <Panel title="Daily average" subtitle={`${days} of ${w.days} days logged · vs. your goals`}>
        <GoalRings rows={MACROS.map((m) => ({ ...m, value: avgPerDay(rows, m.key) }))} />
      </Panel>
      <Panel title={selected.label} subtitle={`${rangeLabel}, average per logged day`}>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
          {MACROS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMacro(m.key)}
              aria-pressed={macro === m.key}
              className={cn(
                "h-8 shrink-0 cursor-pointer rounded-full px-3 text-sm transition-colors",
                macro === m.key ? "text-white" : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              )}
              style={macro === m.key ? { backgroundColor: m.color } : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ColumnChart
          key={macro}
          buckets={w.buckets}
          goal={selected.goal}
          goalLabel="Goal"
          format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}${selected.unit}`)}
          series={[{ key: macro, label: selected.label, color: selected.color, values: perBucket(w, data.nutrition, (r) => avgPerDay(r, macro)) }]}
        />
      </Panel>
      {topFoods.length > 0 && (
        <Panel title="Most logged" subtitle="Times eaten in this range">
          <BreakdownBars rows={topFoods} color="#C9A24A" format={(v) => `${v}×`} />
        </Panel>
      )}
      <EntryList
        empty="No meals in this range."
        items={rows.map((n) => ({
          key: n.id,
          date: n.date,
          title: n.food_name,
          detail: n.calories != null ? `${Math.round(n.calories)} cal` : undefined,
          note: [
            n.meal_type && n.meal_type !== "unknown" ? cap(n.meal_type) : null,
            n.protein != null ? `P ${Math.round(n.protein)}g` : null,
            n.carbs != null ? `C ${Math.round(n.carbs)}g` : null,
            n.fat != null ? `F ${Math.round(n.fat)}g` : null,
            n.fiber != null ? `Fiber ${Math.round(n.fiber)}g` : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
          edit: { table: "nutrition" as const, row: n },
        }))}
      />
    </>
  )
}

/* --------------------------------------------------------------- Workout */

const KM_PER_MI = 1.609344
/** Ride/swim distance as a short label in its own unit. */
function cardioDistance(c: TrendData["cardio"][number]) {
  return c.distance != null ? `${c.distance} ${c.distance_unit ?? (c.activity === "swim" ? "yd" : "mi")}` : null
}
function toMiles(c: TrendData["cardio"][number]) {
  if (c.distance == null) return 0
  return c.distance_unit === "km" ? c.distance / KM_PER_MI : c.distance_unit === "mi" || !c.distance_unit ? c.distance : 0
}

function WorkoutDetail({ data, w }: DetailProps) {
  const lifts = data.gym.filter(inWindow(w))
  const runs = data.runs.filter(inWindow(w))
  const cardio = data.cardio.filter(inWindow(w))
  const of = (a: CardioActivity) => cardio.filter((c) => c.activity === a)
  const runMiles = sum(runs, (r) => r.distance_miles)
  const days = workoutDays(data)
  const inRangeDays = [...days].filter((d) => inRange(d, w.start, w.today)).length
  // Sunday through today, for the weekly goal.
  const weekStart = shiftKey(w.today, -keyToDate(w.today).getDay())
  const thisWeek = [...days].filter((d) => inRange(d, weekStart, w.today)).length
  const goal = weeklyWorkoutGoal(data.prefs)
  const plan = workoutPlan(data.prefs)

  const exercises = new Map<string, { sessions: Set<string> }>()
  for (const l of lifts) {
    const e = exercises.get(l.exercise) ?? { sessions: new Set() }
    e.sessions.add(l.date)
    exercises.set(l.exercise, e)
  }
  const top = [...exercises.entries()]
    .map(([label, e]) => ({ label, value: e.sessions.size }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  // "3×10 · 135 lb": one list row per logged lift, so each can be edited.
  const liftDetail = (l: (typeof lifts)[number]) =>
    [
      l.sets != null && l.reps != null ? `${l.sets}×${l.reps}` : l.sets != null ? `${l.sets} set${l.sets === 1 ? "" : "s"}` : l.reps != null ? `${l.reps} reps` : null,
      l.unit === "bodyweight" ? "bodyweight" : l.weight ? `${l.weight} ${l.unit === "kg" ? "kg" : "lb"}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || undefined
  const minutes = (s: number | null) => (s ? `${Math.round(s / 60)} min` : null)

  return (
    <>
      <StatGrid
        stats={[
          { label: "Workout days", value: String(inRangeDays), hint: `of ${w.days}` },
          ...(goal
            ? [
                {
                  label: "This week",
                  value: `${thisWeek} / ${goal}`,
                  hint: thisWeek >= goal ? "Goal hit" : `${goal - thisWeek} to go`,
                },
              ]
            : []),
          { label: "Exercises", value: String(exercises.size) },
          { label: "Runs", value: String(runs.length), hint: runMiles ? `${runMiles.toFixed(1)} mi` : undefined },
          // Rides, swims, walks, hikes: count, plus miles where it's in miles/km.
          ...(Object.keys(CARDIO) as CardioActivity[]).map((a) => {
            const miles = sum(of(a), toMiles)
            return { label: CARDIO[a].plural, value: String(of(a).length), hint: miles ? `${miles.toFixed(1)} mi` : undefined }
          }),
        ]}
      />
      {plan && <WeekPlan data={data} plan={plan} today={w.today} weekStart={weekStart} />}
      <Panel title="Workout days" subtitle="Green means you trained that day">
        <DayGrid months={calendarMonths(w)} active={days} color="#5E9C78" start={w.start} end={w.today} />
      </Panel>
      {top.length > 0 && (
        <Panel title="Most trained" subtitle="Sessions per exercise">
          <BreakdownBars rows={top} color="#6A7FB8" format={(v) => `${v}×`} />
        </Panel>
      )}
      <EntryList
        empty="No workouts in this range."
        items={[
          ...lifts.map((l) => ({
            key: l.id,
            date: l.date,
            title: `🏋️ ${l.exercise}`,
            detail: liftDetail(l),
            edit: { table: "gym_weight" as const, row: l },
          })),
          ...runs.map((r) => ({
            key: r.id,
            date: r.date,
            title: "🏃 Run",
            detail: `${r.distance_miles.toFixed(1)} mi · ${Math.round(r.duration_seconds / 60)} min`,
            edit: { table: "runs" as const, row: r },
          })),
          ...cardio.map((c) => ({
            key: c.id,
            date: c.date,
            title: `${CARDIO[c.activity].emoji} ${CARDIO[c.activity].noun}`,
            detail: [cardioDistance(c), minutes(c.duration_seconds)].filter(Boolean).join(" · ") || undefined,
            edit: { table: "cardio" as const, row: c },
          })),
        ]}
      />
    </>
  )
}

const KIND_ICON: Record<WorkoutKind, LucideIcon> = {
  lift: Dumbbell,
  run: Footprints,
  ...Object.fromEntries((Object.keys(CARDIO) as CardioActivity[]).map((a) => [a, CARDIO[a].icon])),
} as Record<WorkoutKind, LucideIcon>
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]

/** Sunday to Saturday of this week: what was planned, and whether it got done. */
function WeekPlan({
  data,
  plan,
  today,
  weekStart,
}: {
  data: TrendData
  plan: WorkoutKind[][]
  today: string
  weekStart: string
}) {
  const did = (kind: WorkoutKind, day: string) =>
    kind === "lift"
      ? data.gym.some((g) => g.date === day)
      : kind === "run"
        ? data.runs.some((r) => r.date === day)
        : data.cardio.some((c) => c.date === day && c.activity === kind)

  const days = plan.map((kinds, i) => {
    const key = shiftKey(weekStart, i)
    const done = kinds.filter((k) => did(k, key))
    const state =
      kinds.length === 0
        ? "rest"
        : done.length === kinds.length
          ? "done"
          : key > today
            ? "upcoming"
            : key === today
              ? "today"
              : "missed"
    return { key, kinds, done, state }
  })
  const missed = days.filter((d) => d.state === "missed").length
  const todayPlan = days.find((d) => d.key === today)

  return (
    <Panel
      title="This week"
      subtitle={
        todayPlan?.state === "today"
          ? `Today: ${planLabel(todayPlan.kinds.filter((k) => !todayPlan.done.includes(k)))}`
          : missed
            ? `${missed} planned day${missed === 1 ? "" : "s"} missed`
            : "On track"
      }
    >
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => (
          <div key={d.key} className="flex flex-col items-center gap-1.5">
            <span className={cn("text-[11px]", d.key === today ? "font-semibold text-neutral-900 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-500")}>
              {DAY_LETTERS[i]}
            </span>
            <div
              className={cn(
                "flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-xl ring-1 ring-inset",
                d.state === "done" && "bg-[#5E9C78] text-white ring-transparent",
                d.state === "missed" && "bg-[#C8735F]/12 text-[#B0614E] ring-[#C8735F]/40 dark:text-[#E09A88]",
                d.state === "today" && "bg-white text-neutral-900 ring-2 ring-[#318E63] dark:bg-neutral-900 dark:text-neutral-100",
                d.state === "upcoming" && "bg-neutral-100 text-neutral-500 ring-black/10 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-white/10",
                d.state === "rest" && "bg-transparent text-neutral-300 ring-black/10 dark:text-neutral-600 dark:ring-white/10"
              )}
              title={planLabel(d.kinds) ?? "Rest"}
            >
              {d.state === "rest" ? (
                <span className="text-[10px]">Rest</span>
              ) : d.state === "done" ? (
                <Check className="size-4" strokeWidth={2.5} />
              ) : (
                d.kinds.map((k) => {
                  const Icon = KIND_ICON[k]
                  return <Icon key={k} className={cn("size-3.5", d.done.includes(k) && "opacity-40")} />
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/* ---------------------------------------------------------------- Weight */

function WeightDetail({ data, w, rangeLabel }: DetailProps) {
  const rows = data.weights.filter(inWindow(w))
  const unit = (rows[rows.length - 1] ?? data.weights[data.weights.length - 1])?.unit === "kg" ? "kg" : "lb"
  const values = rows.map((r) => r.weight)
  // With only one weigh-in in range, start the line from the one before it.
  const baseline = data.weights.filter((x) => x.date < w.start).pop()
  const linePoints = rows.length >= 2 || !baseline ? rows : [baseline, ...rows]

  return (
    <>
      <Panel title="Weight" subtitle={linePoints.length > rows.length ? `${rangeLabel}, from your last weigh-in before it` : rangeLabel}>
        {linePoints.length >= 2 ? (
          <PointLine
            points={linePoints.map((r) => ({ date: r.date, value: r.weight }))}
            color="#5A9E9A"
            goal={data.prefs.weightGoal ?? undefined}
          />
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {linePoints.length === 1 ? "Log one more weigh-in to see your line." : "No weigh-ins yet. Tap + to log one."}
          </p>
        )}
      </Panel>
      {rows.length > 0 && (
        <StatGrid
          stats={[
            { label: "Lowest", value: `${Math.min(...values)} ${unit}` },
            { label: "Highest", value: `${Math.max(...values)} ${unit}` },
            { label: "Average", value: `${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)} ${unit}` },
            { label: "Weigh-ins", value: String(rows.length) },
            ...(data.prefs.weightGoal
              ? [
                  {
                    label: "To goal",
                    value:
                      Math.abs(values[values.length - 1] - data.prefs.weightGoal) < 0.1
                        ? "At goal"
                        : `${Math.abs(Math.round((values[values.length - 1] - data.prefs.weightGoal) * 10) / 10)} ${unit}`,
                    hint: `goal ${data.prefs.weightGoal} ${unit}`,
                  },
                ]
              : []),
          ]}
        />
      )}
      <EntryList
        empty="No weigh-ins in this range."
        items={rows.map((r, i) => {
          const before = i > 0 ? rows[i - 1].weight : baseline?.weight ?? null
          const diff = before !== null ? Math.round((r.weight - before) * 10) / 10 : null
          return {
            key: r.id,
            date: r.date,
            title: `${r.weight} ${unit}`,
            detail: diff ? `${diff > 0 ? "+" : ""}${diff}` : undefined,
            edit: { table: "personal_weight" as const, row: r },
          }
        })}
      />
    </>
  )
}

/* ----------------------------------------------------------------- Sleep */

function SleepDetail({ data, w, rangeLabel }: DetailProps) {
  const rows = data.sleep.filter(inWindow(w))
  const withHours = rows.filter((s) => s.hours != null)
  const best = withHours.reduce<(typeof rows)[number] | null>((b, s) => (!b || (s.hours ?? 0) > (b.hours ?? 0) ? s : b), null)
  const worst = withHours.reduce<(typeof rows)[number] | null>((b, s) => (!b || (s.hours ?? 0) < (b.hours ?? 0) ? s : b), null)
  const goal = data.prefs.sleepGoalHours ?? DEFAULT_SLEEP_GOAL
  const under7 = withHours.filter((s) => (s.hours ?? 0) < goal).length
  const avgOf = (r: TrendData["sleep"], key: "hours" | "score") => {
    const h = r.filter((s) => s[key] != null)
    return h.length ? sum(h, (s) => s[key]) / h.length : NaN
  }
  const hasScores = rows.some((s) => s.score != null)
  const short = (key: string) => keyToDate(key).toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <>
      <Panel title="Hours slept" subtitle={w.range.id === "d" || w.range.id === "m" ? `${rangeLabel}, each night` : `${rangeLabel}, average ${per(w)}`}>
        <BucketLine
          buckets={w.buckets}
          values={perBucket(w, data.sleep, (r) => avgOf(r, "hours"))}
          color="#8A7BB8"
          goal={goal}
          goalLabel={`${goal}h`}
          format={(v) => `${v}h`}
        />
      </Panel>
      <StatGrid
        stats={[
          { label: "Nights logged", value: String(rows.length), hint: `of ${w.days}` },
          { label: `Under ${goal} hours`, value: `${under7} night${under7 === 1 ? "" : "s"}` },
          { label: "Longest", value: best?.hours != null ? hoursLabel(best.hours) : "—", hint: best ? short(best.date) : undefined },
          { label: "Shortest", value: worst?.hours != null ? hoursLabel(worst.hours) : "—", hint: worst ? short(worst.date) : undefined },
        ]}
      />
      {hasScores && (
        <Panel title="Sleep score" subtitle={w.range.id === "d" || w.range.id === "m" ? `${rangeLabel}, each night` : `${rangeLabel}, average ${per(w)}`}>
          <BucketLine buckets={w.buckets} values={perBucket(w, data.sleep, (r) => avgOf(r, "score"))} color="#B3A6D6" />
        </Panel>
      )}
      <EntryList
        empty="No sleep logged in this range."
        items={rows.map((s) => ({
          key: s.id,
          date: s.date,
          title: s.hours != null ? hoursLabel(s.hours) : "Sleep",
          detail: s.score != null ? `Score ${s.score}` : undefined,
          edit: { table: "sleep" as const, row: s },
        }))}
      />
    </>
  )
}

/* --------------------------------------------------------------- Journal */

function JournalDetail({ data, w, rangeLabel }: DetailProps) {
  const rows = data.journal.filter(inWindow(w))
  const moods = rows.map((j) => j.mood).filter((m): m is string => !!m && m !== "unknown")
  const counts = new Map<string, number>()
  for (const m of moods) counts.set(m, (counts.get(m) ?? 0) + 1)
  const moodRows = [...counts.entries()].map(([label, value]) => ({ label: cap(label), value })).sort((a, b) => b.value - a.value)
  const top = topCount(moods)

  // Longest run of consecutive days with an entry, ending today or yesterday.
  const days = new Set(data.journal.map((j) => j.date))
  let streak = 0
  let cursor = days.has(w.today) ? w.today : shiftKey(w.today, -1)
  while (days.has(cursor)) {
    streak++
    cursor = shiftKey(cursor, -1)
  }

  return (
    <>
      <StatGrid
        stats={[
          { label: "Entries", value: String(rows.length) },
          { label: "Current streak", value: `${streak} day${streak === 1 ? "" : "s"}` },
          { label: "Most common mood", value: top ? cap(top) : "—" },
          { label: "Days written", value: String(distinctDays(rows)), hint: `of ${w.days}` },
        ]}
      />
      {w.range.id !== "d" && (
        <Panel title="Entries" subtitle={`${rangeLabel}, ${per(w)}`}>
          <ColumnChart buckets={w.buckets} series={[{ key: "entries", label: "Entries", color: "#C8735F", values: perBucket(w, data.journal, (r) => r.length) }]} />
        </Panel>
      )}
      {moodRows.length > 0 && (
        <Panel title="Moods" subtitle="How your entries felt">
          <BreakdownBars rows={moodRows} color="#C8735F" format={(v) => `${v}×`} />
        </Panel>
      )}
      <EntryList
        empty="No journal entries in this range."
        items={rows.map((j) => ({
          key: j.id,
          date: j.date,
          title: j.title || "Untitled entry",
          detail: j.mood && j.mood !== "unknown" ? cap(j.mood) : undefined,
          note: data.prefs.journalHideText ? undefined : j.entry.slice(0, 200),
          edit: { table: "journal" as const, row: j },
        }))}
      />
    </>
  )
}

/* ---------------------------------------------------------------- Habits */

function HabitsDetail({ input, w, rangeLabel }: { input: HabitsInput; w: Window; rangeLabel: string }) {
  const { habits, completions } = input
  if (!habits.length) {
    return (
      <Panel>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No habits yet. Add them from the old dashboard&apos;s Habits page for now.
        </p>
      </Panel>
    )
  }

  const perHabit = habits.map((h) => {
    const done = new Set(completions.filter((c) => c.habitId === h.id).map((c) => c.date))
    // Streak counts scheduled days in a row; days it isn't due are skipped.
    let streak = 0
    let cursor = done.has(w.today) || !isDueOn(h, w.today) ? w.today : shiftKey(w.today, -1)
    for (let guard = 0; guard < 400; guard++) {
      if (!isDueOn(h, cursor)) {
        cursor = shiftKey(cursor, -1)
        continue
      }
      if (!done.has(cursor)) break
      streak++
      cursor = shiftKey(cursor, -1)
    }
    return { habit: h, rate: habitRate({ habits: [h], completions }, w.start, w.today), streak }
  })
  const bestStreak = perHabit.reduce((b, h) => (h.streak > b.streak ? h : b), perHabit[0])

  return (
    <>
      <StatGrid
        stats={[
          { label: "Habits", value: String(habits.length) },
          { label: "Best streak", value: `${bestStreak.streak} day${bestStreak.streak === 1 ? "" : "s"}`, hint: bestStreak.streak ? bestStreak.habit.name : undefined },
        ]}
      />
      <Panel title="Completion" subtitle={`${rangeLabel}, ${per(w)}`}>
        <ColumnChart
          buckets={w.buckets}
          format={(v) => `${Math.round(v)}%`}
          series={[{ key: "rate", label: "Done", color: "#318E63", values: w.buckets.map((b) => habitRate(input, b.start, b.end)) }]}
        />
      </Panel>
      <Panel title="By habit" subtitle="% of days done in this range">
        <BreakdownBars
          rows={perHabit.map((h) => ({ label: h.habit.name, value: h.rate })).sort((a, b) => b.value - a.value)}
          color="#318E63"
          format={(v) => `${v}%`}
        />
      </Panel>
    </>
  )
}

/* ----------------------------------------------------------- Supplements */

function SupplementsDetail({ data, w }: DetailProps) {
  const [filter, setFilter] = React.useState<string | null>(null)
  if (!data.supplementsReady) {
    return (
      <Panel>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          The supplements tables aren&apos;t set up yet. Run the supplements SQL in Supabase, then log your first one with +.
        </p>
      </Panel>
    )
  }
  const rows = data.supplements.filter(inWindow(w))
  const names = [...new Set([...data.stack.map((s) => s.name), ...rows.map((r) => r.name)])]
  const takenDays = new Set(data.supplements.filter((s) => !filter || s.name === filter).map((s) => s.date))
  const counts = new Map<string, number>()
  for (const s of rows) counts.set(s.name, (counts.get(s.name) ?? 0) + 1)
  const byName = [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

  return (
    <>
      <Panel title="Your stack" subtitle={data.stack.length ? `${data.stack.length} active` : undefined}>
        {data.stack.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nothing in your stack yet. Log a supplement with + and keep &ldquo;Add to my stack&rdquo; checked.
          </p>
        ) : (
          <ul className="-mx-5 -mb-2">
            {data.stack.map((s) => {
              // Days taken out of the days it was due, not every day (zinc on
              // M/W/F shouldn't read 3/26). Off-schedule days are counted apart.
              const days = supplementSchedule(data.prefs, s.id)
              const isDue = (d: string) => !days || days.includes(keyToDate(d).getDay())
              const takenOn = new Set(rows.filter((r) => r.name === s.name).map((r) => r.date))
              const n = [...takenOn].filter(isDue).length
              const extra = takenOn.size - n
              let due = 0
              for (let d = w.start; d <= w.today; d = shiftKey(d, 1)) if (isDue(d)) due++
              return (
                <li key={s.id} className="flex min-h-14 items-center gap-3 border-t border-neutral-100 px-5 py-2 first:border-t-0 dark:border-neutral-800">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#C27A981F] text-base">💊</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-neutral-900 dark:text-neutral-100">{s.name}</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {[
                        s.dose != null ? `${s.dose} ${s.unit ?? ""}`.trim() : null,
                        days ? scheduleLabel(days) : null,
                        s.timing && s.timing !== "any" ? cap(s.timing) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No dose set"}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-sm tabular-nums text-neutral-500 dark:text-neutral-400">
                    {n}/{due} days
                    {extra > 0 && <span className="block text-xs">+{extra} off-schedule</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
      <Panel title="Days taken" subtitle={filter ? `When you took ${filter}` : "Days you took anything"}>
        {names.length > 1 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
            {[null, ...names].map((n) => (
              <button
                key={n ?? "all"}
                type="button"
                onClick={() => setFilter(n)}
                aria-pressed={filter === n}
                className={cn(
                  "h-8 shrink-0 cursor-pointer rounded-full px-3 text-sm whitespace-nowrap transition-colors",
                  filter === n ? "bg-[#C27A98] text-white" : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                )}
              >
                {n ?? "All"}
              </button>
            ))}
          </div>
        )}
        <DayGrid months={calendarMonths(w)} active={takenDays} color="#C27A98" start={w.start} end={w.today} />
      </Panel>
      {byName.length > 0 && (
        <Panel title="By supplement" subtitle="Doses in this range">
          <BreakdownBars rows={byName} color="#C27A98" format={(v) => `${v}×`} />
        </Panel>
      )}
      <EntryList
        empty="Nothing logged in this range."
        items={rows.map((s) => ({
          key: s.id,
          date: s.date,
          title: s.name,
          detail: s.dose != null ? `${s.dose} ${s.unit ?? ""}`.trim() : undefined,
          edit: { table: "supplement_logs" as const, row: s },
        }))}
      />
    </>
  )
}

/** Spending against the monthly budget, scaled to the selected range. */
function BudgetPanel({ monthly, spent, w }: { monthly: number; spent: number; w: Window }) {
  const t = keyToDate(w.today)
  const daysInMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
  const budget = { d: monthly / daysInMonth, m: monthly, q: monthly * 3, y: monthly * 12 }[w.range.id]
  const pct = budget > 0 ? spent / budget : 0
  const over = spent > budget
  return (
    <Panel title="Budget" subtitle={{ d: "Today's share", m: "This month", q: "This quarter (3 months)", y: "This year (12 months)" }[w.range.id]}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">
          <span className="text-lg font-medium text-neutral-900 dark:text-neutral-100">{usd.format(spent)}</span> of {usd.format(budget)}
        </span>
        <span className={cn("font-medium", over ? "text-[#C0675E]" : "text-[#4E8A6B]")}>
          {over ? `${usd.format(spent - budget)} over` : `${usd.format(budget - spent)} left`}
        </span>
      </div>
      <span className="h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(pct, 1) * 100}%`, backgroundColor: over ? "#C0675E" : pct > 0.85 ? "#C9A24A" : "#4E8A6B" }}
        />
      </span>
    </Panel>
  )
}
