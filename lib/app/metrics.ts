// Turns raw rows into the numbers the Trends cards and category pages show.
// Pure functions, safe on server or client.

import { buildBuckets, inRange, shiftKey, windowStarts, type Bucket, type Range } from "@/lib/app/dates"
import type { TrendCategory, TrendData } from "@/lib/app/trend-data"
import { isDueOn, type Completion, type Habit } from "@/lib/habits"

export type Window = {
  today: string
  range: Range
  /** Days so far in this period, including today. */
  days: number
  start: string
  prevStart: string
  prevEnd: string
  buckets: Bucket[]
}

export function makeWindow(today: string, range: Range): Window {
  return { today, range, ...windowStarts(today, range.id), buckets: buildBuckets(today, range.id) }
}

const cur = (w: Window) => (r: { date: string }) => inRange(r.date, w.start, w.today)
const prev = (w: Window) => (r: { date: string }) => inRange(r.date, w.prevStart, w.prevEnd)

/** Sum (or average) a value per chart column. */
export function perBucket<T extends { date: string }>(
  w: Window,
  rows: T[],
  value: (rows: T[], bucket: Bucket) => number
): number[] {
  return w.buckets.map((b) => value(rows.filter((r) => inRange(r.date, b.start, b.end)), b))
}

export const sum = <T,>(rows: T[], f: (r: T) => number | null | undefined) =>
  rows.reduce((total, r) => total + (f(r) ?? 0), 0)

export function distinctDays<T extends { date: string }>(rows: T[]) {
  return new Set(rows.map((r) => r.date)).size
}

/** % change, or null when there's nothing to compare against. */
export function pctChange(now: number, before: number): number | null {
  if (!before) return null
  return Math.round(((now - before) / before) * 100)
}

export const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
export const usdCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export function hoursLabel(hours: number) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m === 60 ? `${h + 1}h` : m === 0 ? `${h}h` : `${h}h ${m}m`
}

export type Summary = {
  value: string
  /** Second line under the big number. */
  sub: string
  /** e.g. "↑ 12% vs previous 30 days"; null when there's no baseline. */
  change: string | null
  /** One number per chart column, for the sparkline. */
  series: number[]
  /** Nothing logged in this window. */
  empty: boolean
}

function changeLine(pct: number | null, w: Window, unit = "%") {
  if (pct === null) return null
  if (pct === 0) return `Same as ${w.range.compare}`
  const arrow = pct > 0 ? "↑" : "↓"
  return `${arrow} ${Math.abs(pct)}${unit} vs ${w.range.compare}`
}

export type HabitsInput = { habits: Habit[]; completions: Completion[] }

export function summarize(
  category: TrendCategory,
  data: TrendData,
  w: Window,
  habitsInput: HabitsInput
): Summary {
  switch (category) {
    case "money": {
      const expense = (rows: TrendData["transactions"]) =>
        sum(rows.filter((t) => t.transaction_type === "expense"), (t) => t.amount)
      const now = data.transactions.filter(cur(w))
      const spent = expense(now)
      const income = sum(now.filter((t) => t.transaction_type === "income"), (t) => t.amount)
      return {
        value: usd.format(spent),
        sub: income > 0 ? `spent · ${usd.format(income)} in` : "spent",
        change: changeLine(pctChange(spent, expense(data.transactions.filter(prev(w)))), w),
        series: perBucket(w, data.transactions, (rows) => expense(rows)),
        empty: now.length === 0,
      }
    }
    case "nutrition": {
      const avg = (rows: TrendData["nutrition"]) => {
        const days = distinctDays(rows)
        return days ? sum(rows, (n) => n.calories) / days : 0
      }
      const now = data.nutrition.filter(cur(w))
      const a = avg(now)
      const protein = distinctDays(now) ? sum(now, (n) => n.protein) / distinctDays(now) : 0
      return {
        value: Math.round(a).toLocaleString(),
        sub: `avg calories/day · ${Math.round(protein)}g protein`,
        change: changeLine(pctChange(a, avg(data.nutrition.filter(prev(w)))), w),
        // NaN = nothing logged that day; the sparkline skips it instead of dipping to 0.
        series: perBucket(w, data.nutrition, (rows) => (rows.length ? avg(rows) : NaN)),
        empty: now.length === 0,
      }
    }
    case "workout": {
      const days = (test: (r: { date: string }) => boolean) => workoutDays(data, test).size
      const n = days(cur(w))
      const before = days(prev(w))
      const miles = sum(data.runs.filter(cur(w)), (r) => r.distance_miles)
      return {
        value: String(n),
        sub: `workout day${n === 1 ? "" : "s"}${miles > 0 ? ` · ${miles.toFixed(1)} mi run` : ""}`,
        change: before ? changeLine(n - before, w, n - before === 1 || n - before === -1 ? " day" : " days") : null,
        series: w.buckets.map((b) => days((r) => inRange(r.date, b.start, b.end))),
        empty: n === 0,
      }
    }
    case "weight": {
      const inWindow = data.weights.filter(cur(w))
      const latest = data.weights[data.weights.length - 1]
      const baseline = data.weights.filter((x) => x.date < w.start).pop() ?? inWindow[0]
      const unit = latest?.unit === "kg" ? "kg" : "lb"
      const change = latest && baseline ? Math.round((latest.weight - baseline.weight) * 10) / 10 : null
      return {
        value: latest ? `${latest.weight} ${unit}` : "—",
        sub: inWindow.length ? `${inWindow.length} weigh-in${inWindow.length === 1 ? "" : "s"}` : "No weigh-ins in this range",
        change:
          change === null || latest === baseline
            ? null
            : change === 0
              ? "No change"
              : `${change > 0 ? "↑" : "↓"} ${Math.abs(change)} ${unit} over this range`,
        series: inWindow.map((x) => x.weight),
        empty: inWindow.length === 0,
      }
    }
    case "sleep": {
      const avg = (rows: TrendData["sleep"]) => {
        const withHours = rows.filter((s) => s.hours != null)
        return withHours.length ? sum(withHours, (s) => s.hours) / withHours.length : 0
      }
      const now = data.sleep.filter(cur(w))
      const a = avg(now)
      const scored = now.filter((s) => s.score != null)
      const score = scored.length ? Math.round(sum(scored, (s) => s.score) / scored.length) : null
      return {
        value: a ? hoursLabel(a) : "—",
        sub: `avg per night${score !== null ? ` · score ${score}` : ""}`,
        change: changeLine(pctChange(a, avg(data.sleep.filter(prev(w)))), w),
        series: perBucket(w, data.sleep, (rows) => (rows.some((s) => s.hours != null) ? avg(rows) : NaN)),
        empty: now.length === 0,
      }
    }
    case "journal": {
      const now = data.journal.filter(cur(w))
      const moods = now.map((j) => j.mood).filter((m): m is string => !!m && m !== "unknown")
      const top = topCount(moods)
      return {
        value: String(now.length),
        sub: `entr${now.length === 1 ? "y" : "ies"}${top ? ` · mostly ${top}` : ""}`,
        change: changeLine(pctChange(now.length, data.journal.filter(prev(w)).length), w),
        series: perBucket(w, data.journal, (rows) => rows.length),
        empty: now.length === 0,
      }
    }
    case "habits": {
      const rate = habitRate(habitsInput, w.start, w.today)
      const before = habitRate(habitsInput, w.prevStart, w.prevEnd)
      return {
        value: habitsInput.habits.length ? `${rate}%` : "—",
        sub: habitsInput.habits.length ? `of habits done · ${habitsInput.habits.length} habits` : "No habits yet",
        change: before ? changeLine(rate - before, w, " pts") : null,
        series: w.buckets.map((b) => habitRate(habitsInput, b.start, b.end)),
        empty: habitsInput.habits.length === 0,
      }
    }
    case "supplements": {
      const now = data.supplements.filter(cur(w))
      const names = new Set(now.map((s) => s.name))
      return {
        value: String(now.length),
        sub: data.supplementsReady
          ? `dose${now.length === 1 ? "" : "s"} logged · ${names.size} supplement${names.size === 1 ? "" : "s"}`
          : "Run the supplements SQL to start",
        change: changeLine(pctChange(now.length, data.supplements.filter(prev(w)).length), w),
        series: perBucket(w, data.supplements, (rows) => rows.length),
        empty: now.length === 0,
      }
    }
  }
}

/** Dates with any lift, run, ride or swim that pass the filter. */
export function workoutDays(data: TrendData, test: (r: { date: string }) => boolean = () => true) {
  return new Set([
    ...data.gym.filter(test).map((g) => g.date),
    ...data.runs.filter(test).map((r) => r.date),
    ...data.cardio.filter(test).map((c) => c.date),
  ])
}

export function topCount(values: string[]): string | null {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: string | null = null
  let n = 0
  for (const [k, c] of counts) if (c > n) [best, n] = [k, c]
  return best
}

/** % of (habit × day) slots completed between two dates. */
/**
 * % of scheduled (habit × day) slots completed between two dates. Days a
 * habit isn't due (e.g. a Mon/Wed task on a Tuesday) don't count against it.
 */
export function habitRate({ habits, completions }: HabitsInput, start: string, end: string) {
  if (!habits.length) return 0
  let slots = 0
  let done = 0
  const doneSet = new Set(completions.map((c) => `${c.habitId}|${c.date}`))
  for (let day = start; day <= end; day = shiftKey(day, 1)) {
    for (const h of habits) {
      if (!isDueOn(h, day)) continue
      slots++
      if (doneSet.has(`${h.id}|${day}`)) done++
    }
  }
  return slots ? Math.round((done / slots) * 100) : 0
}
