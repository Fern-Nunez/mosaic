// The things Insights can chart. Shared by the server (builds the numbers)
// and the chart (labels, units, colors). The AI only picks ids from here.

import type { SectionId } from "@/lib/app/prefs"

export const INSIGHT_METRICS = {
  sleep: { label: "Sleep", unit: "h", mark: "line", section: "sleep", week: "avg", digits: 1 },
  sleep_score: { label: "Sleep score", unit: "", mark: "line", section: "sleep", week: "avg", digits: 0 },
  workouts: { label: "Workouts", unit: "", mark: "bar", section: "workout", week: "sum", digits: 0 },
  calories: { label: "Calories", unit: "cal", mark: "bar", section: "nutrition", week: "avg", digits: 0 },
  protein: { label: "Protein", unit: "g", mark: "bar", section: "nutrition", week: "avg", digits: 0 },
  spending: { label: "Spending", unit: "$", mark: "bar", section: "money", week: "sum", digits: 0 },
  weight: { label: "Weight", unit: "", mark: "line", section: "weight", week: "avg", digits: 1 },
  mood: { label: "Mood", unit: "/5", mark: "line", section: "journal", week: "avg", digits: 1 },
  habits: { label: "Habits done", unit: "%", mark: "line", section: "habits", week: "avg", digits: 0 },
} as const satisfies Record<
  string,
  { label: string; unit: string; mark: "line" | "bar"; section: SectionId; week: "avg" | "sum"; digits: number }
>

export type MetricId = keyof typeof INSIGHT_METRICS
export const METRIC_IDS = Object.keys(INSIGHT_METRICS) as MetricId[]

export const CHART_SPANS = [14, 30, 90] as const
export type ChartSpan = (typeof CHART_SPANS)[number]

/** One point on the chart: a day (14/30) or a week (90). */
export type ChartPoint = {
  key: string
  label: string
  /** Full label for the detail card, e.g. "Thu, Oct 23" or "Week of Oct 5". */
  title: string
  values: Partial<Record<MetricId, number | null>>
  workouts: string[]
  moods: string[]
}

export type InsightChart = {
  metrics: MetricId[]
  span: ChartSpan
  points: ChartPoint[]
  /** Metrics shown in the tap-for-details card (hidden sections left out). */
  detail: MetricId[]
}

export function formatMetric(id: MetricId, value: number | null | undefined, extraDigits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  const m = INSIGHT_METRICS[id]
  const n = value.toLocaleString("en-US", { maximumFractionDigits: m.digits + extraDigits, minimumFractionDigits: 0 })
  return m.unit === "$" ? `$${n}` : m.unit ? `${n}${m.unit === "h" || m.unit === "%" || m.unit === "/5" ? "" : " "}${m.unit}` : n
}
