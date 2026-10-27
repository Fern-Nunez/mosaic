"use client"

// Small "did I do the thing?" graphics for the Trends cards. Each answers one
// question at a glance, like the sleep bars: a 5-day strip for habits-type
// things, a target line for weight, a budget bar for money.

import * as React from "react"

import { keyToDate, shiftKey } from "@/lib/app/dates"
import { netSpent } from "@/lib/app/money"
import { supplementDue, workoutPlan, type AppPrefs, type WorkoutKind } from "@/lib/app/prefs"
import type { TrendData } from "@/lib/app/trend-data"
import { isDueOn, type Completion, type Habit } from "@/lib/habits"
import { cn } from "@/lib/utils"

const DAYS = 5

/** The last 5 days, oldest first. */
const lastDays = (today: string) => Array.from({ length: DAYS }, (_, i) => shiftKey(today, i - (DAYS - 1)))
const letter = (key: string) => keyToDate(key).toLocaleDateString("en-US", { weekday: "narrow" })

const legendText = "text-[10px] leading-none text-neutral-500 dark:text-neutral-400"
const emptyCell = "border border-dashed border-neutral-400/70 dark:border-neutral-600"

/** Legend on top, 48px of graphic, day letters under it. Same frame as the sleep bars. */
function Frame({ legend, days, children, label }: { legend?: React.ReactNode; days?: string[]; children: React.ReactNode; label: string }) {
  return (
    <div className="flex w-full flex-col gap-1" aria-label={label}>
      {legend && <span className={cn("flex items-center justify-end gap-1", legendText)}>{legend}</span>}
      <div className="relative h-12">{children}</div>
      {days && (
        <div className="flex justify-between gap-1.5">
          {days.map((d) => (
            <span key={d} className={cn("flex-1 text-center", legendText)}>
              {letter(d)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- Workout */

/** Filled = trained. Outlined = planned and not done. Blank = rest / nothing planned. */
export function WorkoutStrip({ data, today, color }: { data: TrendData; today: string; color: string }) {
  const days = lastDays(today)
  const plan = workoutPlan(data.prefs)
  const trained = new Set([...data.gym, ...data.runs, ...data.cardio].map((r) => r.date))
  return (
    <Frame
      label="Workouts, last 5 days"
      days={days}
    >
      <div className="flex h-full items-end justify-between gap-1.5">
        {days.map((d) => {
          const planned: WorkoutKind[] = plan?.[keyToDate(d).getDay()] ?? []
          const done = trained.has(d)
          return (
            <div key={d} className="flex h-full flex-1 items-end" title={done ? "Trained" : planned.length ? "Planned" : "Rest"}>
              <div
                className={cn("aspect-square w-full rounded-[4px]", !done && !planned.length && "bg-neutral-200/70 dark:bg-neutral-800")}
                style={done ? { backgroundColor: color } : planned.length ? { border: `1.5px solid ${color}` } : undefined}
              />
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

/* --------------------------------------------------------------- Journal */

const MOOD_COLOR: Record<string, string> = {
  happy: "#4E8A6B",
  motivated: "#4E8A6B",
  neutral: "#9A938B",
  tired: "#C9A24A",
  anxious: "#C9A24A",
  stressed: "#C8735F",
  sad: "#C8735F",
  angry: "#C8735F",
}

/** One dot per day, colored by that day's mood. Empty = no entry. */
export function MoodDots({ data, today }: { data: TrendData; today: string }) {
  const days = lastDays(today)
  const moodOn = (d: string) => {
    const entries = data.journal.filter((j) => j.date === d)
    if (!entries.length) return null
    return entries.map((j) => j.mood).find((m) => m && m !== "unknown") ?? "written"
  }
  return (
    <Frame
      label="Moods, last 5 days"
      days={days}
    >
      <div className="flex h-full items-center justify-between gap-1.5">
        {days.map((d) => {
          const mood = moodOn(d)
          return (
            <div key={d} className="flex flex-1 justify-center" title={mood ?? "No entry"}>
              <span
                className={cn("size-5 rounded-full", !mood && emptyCell)}
                style={mood ? { backgroundColor: MOOD_COLOR[mood] ?? "#9A938B" } : undefined}
              />
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

/* ---------------------------------------------------------------- Habits */

/** Bar height = share of that day's habits done. Full bar = all of them. */
export function HabitBars({ habits, completions, today, color }: { habits: Habit[]; completions: Completion[]; today: string; color: string }) {
  const days = lastDays(today)
  const done = new Set(completions.map((c) => `${c.habitId}|${c.date}`))
  return (
    <Frame label="Habits done, last 5 days" days={days}>
      <div className="flex h-full items-end justify-between gap-1.5">
        {days.map((d) => {
          const due = habits.filter((h) => isDueOn(h, d))
          const pct = due.length ? due.filter((h) => done.has(`${h.id}|${d}`)).length / due.length : null
          return (
            <div key={d} className="relative flex h-full flex-1 items-end" title={pct == null ? "Nothing due" : `${Math.round(pct * 100)}%`}>
              {/* Track, so an empty day still reads as a day. */}
              <div className="absolute inset-0 rounded-[3px] bg-neutral-200/70 dark:bg-neutral-800" />
              {pct != null && pct > 0 && (
                <div className="relative w-full rounded-[3px]" style={{ height: `${pct * 100}%`, backgroundColor: color }} />
              )}
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

/* ----------------------------------------------------------- Supplements */

/** Full = took everything scheduled that day, half = some, empty = none. */
export function SupplementStrip({ data, today, color }: { data: TrendData; today: string; color: string }) {
  const days = lastDays(today)
  return (
    <Frame
      label="Supplements, last 5 days"
      days={days}
    >
      <div className="flex h-full items-end justify-between gap-1.5">
        {days.map((d) => {
          const due = data.stack.filter((s) => supplementDue(data.prefs, s.id, d))
          const taken = new Set(data.supplements.filter((s) => s.date === d).map((s) => s.name))
          const got = due.filter((s) => taken.has(s.name)).length
          const share = due.length ? got / due.length : taken.size ? 1 : 0
          return (
            <div key={d} className="flex h-full flex-1 items-end" title={due.length ? `${got} of ${due.length}` : "Nothing scheduled"}>
              <div
                className={cn("aspect-square w-full overflow-hidden rounded-[4px]", share === 0 && emptyCell)}
                style={
                  share >= 1
                    ? { backgroundColor: color }
                    : share > 0
                      ? { background: `linear-gradient(to top, ${color} 50%, transparent 50%)`, border: `1.5px solid ${color}` }
                      : undefined
                }
              />
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

/* ---------------------------------------------------------------- Weight */

/** Last 5 weigh-ins joined by a line, with a dashed line at your goal. */
export function WeightMini({ weights, goal, color }: { weights: TrendData["recentWeights"]; goal: number | null; color: string }) {
  if (weights.length === 0) return <Frame label="No weigh-ins yet">{null}</Frame>
  const values = weights.map((w) => w.weight)
  const lo = Math.min(...values, goal ?? Infinity)
  const hi = Math.max(...values, goal ?? -Infinity)
  const pad = Math.max(0.5, (hi - lo) * 0.15)
  const y = (v: number) => 4 + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * 40 // 4..44 of 48
  const x = (i: number) => (weights.length === 1 ? 50 : (i / (weights.length - 1)) * 92 + 4) // % of width
  const unit = weights[weights.length - 1].unit === "kg" ? "kg" : "lb"
  return (
    <Frame
      label={`Last ${weights.length} weigh-ins${goal ? `, goal ${goal}` : ""}`}
      days={undefined}
    >
      <svg viewBox="0 0 100 48" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        {goal != null && (
          <line x1="0" x2="100" y1={y(goal)} y2={y(goal)} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" className="stroke-neutral-400 dark:stroke-neutral-500" strokeWidth={1} />
        )}
        <polyline
          points={weights.map((w, i) => `${x(i)},${y(w.weight)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Dots as HTML so they stay round when the svg stretches. */}
      {weights.map((w, i) => (
        <span
          key={w.id}
          title={`${w.weight} ${unit}`}
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${x(i)}%`, top: `${(y(w.weight) / 48) * 100}%`, backgroundColor: color }}
        />
      ))}
    </Frame>
  )
}

/* ----------------------------------------------------------------- Money */

/**
 * This month's spending against your budget. The tick is where you'd be if
 * you spent evenly through the month. No budget: made vs spent this month.
 */
export function MoneyPace({ data, today, prefs }: { data: TrendData; today: string; prefs: AppPrefs }) {
  const month = data.transactions.filter((t) => t.date.slice(0, 7) === today.slice(0, 7) && t.date <= today)
  const spent = netSpent(month)
  const budget = prefs.moneyBudget ?? null
  const usd = (v: number) => `$${Math.round(v).toLocaleString()}`

  if (!budget) {
    const made = month.filter((t) => t.transaction_type === "income").reduce((s, t) => s + t.amount, 0)
    const top = Math.max(made, spent, 1)
    return (
      <Frame label="Made vs spent this month">
        <div className="flex h-full flex-col justify-center gap-2">
          {[
            { label: "in", value: made, color: "#4E8A6B" },
            { label: "out", value: spent, color: "#C8735F" },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-1.5">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-200/70 dark:bg-neutral-800">
                <div className="h-full rounded-full" style={{ width: `${(r.value / top) * 100}%`, backgroundColor: r.color }} />
              </div>
            </div>
          ))}
        </div>
      </Frame>
    )
  }

  const [y, m, d] = today.split("-").map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const pace = d / daysInMonth // where you'd be spending evenly
  const used = spent / budget
  const over = used > pace
  return (
    <Frame label={`${usd(spent)} of ${usd(budget)} budget`}>
      <div className="flex h-full flex-col justify-center gap-1.5">
        <div className="relative h-3 rounded-full bg-neutral-200/70 dark:bg-neutral-800">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(1, used) * 100}%`, backgroundColor: used > 1 ? "#C8735F" : over ? "#C9A24A" : "#4E8A6B" }}
          />
          {/* Pace tick: spending evenly, you'd be here today. */}
          <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-neutral-900 dark:bg-neutral-100" style={{ left: `${pace * 100}%` }} />
        </div>
        <span className={cn(legendText, "text-right")}>{Math.round(used * 100)}% used</span>
      </div>
    </Frame>
  )
}
