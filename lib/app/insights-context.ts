// Turns everything logged into a compact summary the Insights model can
// reason over. The math happens here, not in the model: cheap models are
// bad at arithmetic across 90 rows, but good at explaining numbers.

import { keyToDate, shiftKey } from "@/lib/app/dates"
import {
  INSIGHT_METRICS,
  METRIC_IDS,
  type ChartPoint,
  type ChartSpan,
  type InsightChart,
  type MetricId,
} from "@/lib/app/insight-metrics"
import { DEFAULT_SLEEP_GOAL, type SectionId } from "@/lib/app/prefs"
import type { TrendData } from "@/lib/app/trend-data"
import { isDueOn, type Habit } from "@/lib/habits"

export type HabitsData = { habits: Habit[]; completions: { habitId: string; date: string }[] }

const DAYS = 90
// Fixed costs land on one day and swamp everything else, so day-by-day
// spending leaves them out. Totals still include them.
const FIXED_COSTS = new Set(["Housing", "Bills", "Utilities", "Insurance", "Rent", "Subscriptions", "Streaming"])
const GOOD_MOODS = new Set(["happy", "motivated"])
const BAD_MOODS = new Set(["stressed", "tired", "sad", "angry", "anxious"])

export type Day = {
  date: string
  calories: number | null
  protein: number | null
  /** Everyday spending: expenses minus fixed costs like rent and bills. */
  spent: number
  fixed: number
  /** Paid back to you (Zelle etc.) for earlier expenses. Not income. */
  paidBack: number
  income: number
  workout: string[]
  sleepHours: number | null
  sleepScore: number | null
  mood: string | null
  journaled: boolean
  weight: number | null
  habitsDone: number
  habitsDue: number
  supplements: number
}

const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function buildDays(data: TrendData, habits: HabitsData, today: string): Day[] {
  const start = shiftKey(today, -(DAYS - 1))
  const days = new Map<string, Day>()
  for (let d = start; d <= today; d = shiftKey(d, 1)) {
    days.set(d, {
      date: d, calories: null, protein: null, spent: 0, fixed: 0, paidBack: 0, income: 0, workout: [],
      sleepHours: null, sleepScore: null, mood: null, journaled: false, weight: null,
      habitsDone: 0, habitsDue: 0, supplements: 0,
    })
  }
  const at = (date: string) => days.get(date)

  for (const n of data.nutrition) {
    const d = at(n.date)
    if (!d) continue
    d.calories = (d.calories ?? 0) + (n.calories ?? 0)
    d.protein = (d.protein ?? 0) + (n.protein ?? 0)
  }
  for (const t of data.transactions) {
    const d = at(t.date)
    if (!d) continue
    if (t.transaction_type === "income") d.income += Number(t.amount)
    else if (t.transaction_type === "reimbursement") d.paidBack += Number(t.amount)
    else if (FIXED_COSTS.has(t.category ?? "")) d.fixed += Number(t.amount)
    else d.spent += Number(t.amount)
  }
  const addWorkout = (date: string, kind: string) => {
    const d = at(date)
    if (d && !d.workout.includes(kind)) d.workout.push(kind)
  }
  data.gym.forEach((g) => addWorkout(g.date, "lift"))
  data.runs.forEach((r) => addWorkout(r.date, "run"))
  data.cardio.forEach((c) => addWorkout(c.date, c.activity))
  // A sleep entry dated D is the night before D.
  for (const s of data.sleep) {
    const d = at(s.date)
    if (!d) continue
    d.sleepHours = s.hours
    d.sleepScore = s.score
  }
  for (const j of data.journal) {
    const d = at(j.date)
    if (!d) continue
    d.journaled = true
    if (j.mood && j.mood !== "unknown") d.mood = j.mood
  }
  for (const w of data.weights) {
    const d = at(w.date)
    if (d) d.weight = w.weight
  }
  for (const s of data.supplements) {
    const d = at(s.date)
    if (d) d.supplements++
  }
  const done = new Set(habits.completions.map((c) => `${c.habitId}|${c.date}`))
  for (const d of days.values()) {
    for (const h of habits.habits) {
      if (!isDueOn(h, d.date)) continue
      d.habitsDue++
      if (done.has(`${h.id}|${d.date}`)) d.habitsDone++
    }
  }
  return [...days.values()]
}

type Metric = { label: string; value: (d: Day) => number | null; unit: string; section: SectionId }

const METRICS: Metric[] = [
  { label: "everyday spending", value: (d) => d.spent, unit: "$/day", section: "money" },
  { label: "calories", value: (d) => d.calories, unit: "cal", section: "nutrition" },
  { label: "sleep the night before", value: (d) => d.sleepHours, unit: "h", section: "sleep" },
  { label: "worked out", value: (d) => (d.workout.length ? 100 : 0), unit: "% of days", section: "workout" },
  { label: "good mood (happy/motivated)", value: (d) => (d.mood ? (GOOD_MOODS.has(d.mood) ? 100 : 0) : null), unit: "% of journaled moods", section: "journal" },
  { label: "habits done", value: (d) => (d.habitsDue ? (d.habitsDone / d.habitsDue) * 100 : null), unit: "%", section: "habits" },
]

type Factor = { label: string; test: (d: Day) => boolean | null; section: SectionId; skip?: string }

/** Every "on days when X vs not" comparison with at least 3 days on each side. */
function comparisons(days: Day[], sleepGoal: number, proteinGoal: number, on: (s: SectionId) => boolean) {
  const factors: Factor[] = [
    { label: "journaled", test: (d) => d.journaled, section: "journal", skip: "good mood (happy/motivated)" },
    { label: "worked out", test: (d) => d.workout.length > 0, section: "workout", skip: "worked out" },
    { label: `slept ${sleepGoal}h+ the night before`, test: (d) => (d.sleepHours == null ? null : d.sleepHours >= sleepGoal), section: "sleep", skip: "sleep the night before" },
    { label: `hit ${proteinGoal}g protein`, test: (d) => (d.protein == null ? null : d.protein >= proteinGoal), section: "nutrition", skip: "calories" },
    { label: "good mood (happy/motivated) vs a low mood", test: (d) => (d.mood ? (GOOD_MOODS.has(d.mood) ? true : BAD_MOODS.has(d.mood) ? false : null) : null), section: "journal", skip: "good mood (happy/motivated)" },
    { label: "spent over $50", test: (d) => d.spent > 50, section: "money", skip: "everyday spending" },
  ]
  const lines: string[] = []
  for (const f of factors) {
    if (!on(f.section)) continue
    for (const m of METRICS) {
      if (m.label === f.skip || !on(m.section)) continue
      const yes: number[] = []
      const no: number[] = []
      for (const d of days) {
        const t = f.test(d)
        const v = m.value(d)
        if (t === null || v === null) continue
        ;(t ? yes : no).push(v)
      }
      if (yes.length < 3 || no.length < 3) continue
      const a = avg(yes)!
      const b = avg(no)!
      lines.push(`- Days ${f.label}: ${m.label} ${round(a)} ${m.unit} (n=${yes.length}) vs ${round(b)} otherwise (n=${no.length})`)
    }
  }
  return lines
}

/** The block of text the model reads. Hidden sections are left out. */
export function buildInsightsContext(
  data: TrendData,
  habits: HabitsData,
  today: string,
  hidden: SectionId[]
): string {
  const on = (s: SectionId) => !hidden.includes(s)
  const days = buildDays(data, habits, today)
  const sleepGoal = data.prefs.sleepGoalHours ?? DEFAULT_SLEEP_GOAL
  const logged = (f: (d: Day) => boolean) => days.filter(f).length

  const summary: string[] = []
  if (on("money")) {
    const spent = days.reduce((s, d) => s + d.spent, 0)
    const fixed = days.reduce((s, d) => s + d.fixed, 0)
    const income = days.reduce((s, d) => s + d.income, 0)
    const paidBack = days.reduce((s, d) => s + d.paidBack, 0)
    summary.push(
      `Money: earned $${round(income, 0)}, spent $${round(Math.max(0, spent + fixed - paidBack), 0)} net over ${DAYS} days: $${round(fixed, 0)} fixed costs (rent, bills) and $${round(spent, 0)} everyday spending ($${round(spent / DAYS)}/day)${paidBack ? `, minus $${round(paidBack, 0)} friends paid back (not income)` : ""}. Daily numbers below are everyday spending before paybacks.`
    )
  }
  if (on("nutrition")) {
    const c = avg(days.filter((d) => d.calories != null).map((d) => d.calories!))
    summary.push(`Nutrition: ${logged((d) => d.calories != null)} days logged, avg ${c ? round(c, 0) : "n/a"} cal on logged days. Goals ${data.goals.calories} cal, ${data.goals.protein}g protein.`)
  }
  if (on("workout")) summary.push(`Workouts: ${logged((d) => d.workout.length > 0)} of ${DAYS} days.`)
  if (on("sleep")) {
    const s = avg(days.filter((d) => d.sleepHours != null).map((d) => d.sleepHours!))
    summary.push(`Sleep: ${logged((d) => d.sleepHours != null)} nights logged, avg ${s ? round(s) : "n/a"}h, goal ${sleepGoal}h.`)
  }
  if (on("journal")) {
    const moods = new Map<string, number>()
    days.forEach((d) => d.mood && moods.set(d.mood, (moods.get(d.mood) ?? 0) + 1))
    summary.push(`Journal: ${logged((d) => d.journaled)} entries. Moods: ${[...moods].map(([m, n]) => `${m} ${n}`).join(", ") || "none"}.`)
  }
  if (on("weight")) {
    const w = days.filter((d) => d.weight != null)
    summary.push(`Weight: ${w.length ? `${w[0].weight} on ${w[0].date} to ${w[w.length - 1].weight} on ${w[w.length - 1].date}` : "no weigh-ins"}${data.prefs.weightGoal ? `, goal ${data.prefs.weightGoal}` : ""}.`)
  }
  if (on("habits")) {
    const due = days.reduce((s, d) => s + d.habitsDue, 0)
    const done = days.reduce((s, d) => s + d.habitsDone, 0)
    summary.push(`Habits: ${habits.habits.map((h) => h.name).join(", ") || "none"}. ${due ? round((done / due) * 100, 0) : 0}% done.`)
  }

  // One row per day, oldest first, for lookups like "what did I do on my best days".
  const cols: [string, SectionId | null, (d: Day) => string][] = [
    ["date", null, (d) => d.date.slice(5)],
    ["cal", "nutrition", (d) => (d.calories == null ? "" : String(round(d.calories, 0)))],
    ["protein", "nutrition", (d) => (d.protein == null ? "" : String(round(d.protein, 0)))],
    ["spent", "money", (d) => (d.spent ? String(round(d.spent, 0)) : "")],
    ["workout", "workout", (d) => d.workout.join("+")],
    ["sleep_h", "sleep", (d) => (d.sleepHours == null ? "" : String(d.sleepHours))],
    ["mood", "journal", (d) => d.mood ?? (d.journaled ? "journaled" : "")],
    ["weight", "weight", (d) => (d.weight == null ? "" : String(d.weight))],
    ["habits", "habits", (d) => (d.habitsDue ? `${d.habitsDone}/${d.habitsDue}` : "")],
  ]
  const shown = cols.filter(([, s]) => s === null || on(s))
  const table = [
    shown.map(([h]) => h).join(","),
    ...days.map((d) => shown.map(([, , f]) => f(d)).join(",")),
  ].join("\n")

  const comps = comparisons(days, sleepGoal, data.goals.protein, on)

  return [
    `Today is ${today}. Data covers the last ${DAYS} days.`,
    "",
    "SUMMARY",
    ...summary,
    "",
    "COMPARISONS (already computed; use these for any 'does X affect Y' question)",
    ...(comps.length ? comps : ["- Not enough overlapping data yet."]),
    "",
    "DAILY LOG (blank = not logged; mood is from the journal)",
    table,
  ].join("\n")
}

/* ---------------------------------------------------------- Charts */

// For charting mood as a line. Rough, but consistent.
const MOOD_SCORE: Record<string, number> = {
  happy: 5, motivated: 5, neutral: 3, tired: 2, stressed: 2, anxious: 2, sad: 1, angry: 1,
}

function metricValue(id: MetricId, d: Day): number | null {
  switch (id) {
    case "sleep": return d.sleepHours
    case "sleep_score": return d.sleepScore
    case "workouts": return d.workout.length
    case "calories": return d.calories
    case "protein": return d.protein
    case "spending": return d.spent
    case "weight": return d.weight
    case "mood": return d.mood ? (MOOD_SCORE[d.mood] ?? null) : null
    case "habits": return d.habitsDue ? (d.habitsDone / d.habitsDue) * 100 : null
  }
}

const short = (key: string) => keyToDate(key).toLocaleDateString("en-US", { month: "short", day: "numeric" })

/**
 * Real numbers for the chart the model asked for: one point per day for
 * 14/30 days, one per week for 90. Hidden sections are never charted.
 */
export function buildChart(days: Day[], wanted: MetricId[], span: ChartSpan, hidden: SectionId[]): InsightChart | null {
  const visible = (id: MetricId) => !hidden.includes(INSIGHT_METRICS[id].section)
  const metrics = [...new Set(wanted)].filter((id) => METRIC_IDS.includes(id) && visible(id)).slice(0, 2)
  if (!metrics.length) return null
  const detail = METRIC_IDS.filter(visible)
  const recent = days.slice(-span)

  const point = (group: Day[], title: string, label: string): ChartPoint => ({
    key: group[0].date,
    label,
    title,
    values: Object.fromEntries(
      detail.map((id) => {
        const xs = group.map((d) => metricValue(id, d)).filter((v): v is number => v != null)
        if (!xs.length) return [id, null]
        const total = xs.reduce((a, b) => a + b, 0)
        return [id, INSIGHT_METRICS[id].week === "sum" ? total : total / xs.length]
      })
    ),
    workouts: [...new Set(group.flatMap((d) => d.workout))],
    moods: group.map((d) => d.mood).filter((m): m is string => !!m),
  })

  let points: ChartPoint[]
  if (span === 90) {
    // Weeks, counted back from today so the last one is the current week.
    const weeks: Day[][] = []
    for (let end = recent.length; end > 0; end -= 7) weeks.unshift(recent.slice(Math.max(0, end - 7), end))
    points = weeks.map((w) => point(w, `Week of ${short(w[0].date)}`, short(w[0].date)))
  } else {
    points = recent.map((d) =>
      point([d], keyToDate(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), short(d.date))
    )
  }
  return { metrics, span, points, detail }
}
