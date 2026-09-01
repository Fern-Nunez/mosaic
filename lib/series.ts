import type {
  GymRow,
  JournalRow,
  NutritionRow,
  SleepRow,
  TransactionRow,
  WeightRow,
} from "@/lib/types"

/**
 * Every tracked thing, reduced to one number per day.
 *
 * The overview chart compares any two of these, so they all have to arrive in
 * the same shape regardless of how the underlying table stores them — some
 * are one row per day (weight, sleep), some are many rows summed into a day
 * (meals, sets, transactions), and mood is a word rather than a number.
 */

export type SeriesId =
  | "weight"
  | "sleepScore"
  | "sleepHours"
  | "calories"
  | "protein"
  | "volume"
  | "spend"
  | "mood"

export type SeriesMeta = {
  id: SeriesId
  label: string
  /** Shown on the axis and in tooltips. */
  unit: string
  /** Tailwind-independent colour so the chart works in both themes. */
  color: string
  /** Rounding for display. Weight and hours want a decimal; counts do not. */
  decimals: number
}

export const SERIES: SeriesMeta[] = [
  { id: "weight", label: "Weight", unit: "", color: "#8b5cf6", decimals: 1 },
  { id: "sleepScore", label: "Sleep score", unit: "", color: "#38bdf8", decimals: 0 },
  { id: "sleepHours", label: "Hours slept", unit: "h", color: "#22d3ee", decimals: 1 },
  { id: "calories", label: "Calories", unit: "", color: "#f59e0b", decimals: 0 },
  { id: "protein", label: "Protein", unit: "g", color: "#fb923c", decimals: 0 },
  { id: "volume", label: "Training volume", unit: "", color: "#6366f1", decimals: 0 },
  { id: "spend", label: "Spending", unit: "$", color: "#10b981", decimals: 0 },
  { id: "mood", label: "Mood", unit: "/5", color: "#f43f5e", decimals: 1 },
]

export function seriesMeta(id: SeriesId): SeriesMeta {
  return SERIES.find((s) => s.id === id) ?? SERIES[0]
}

/**
 * Mood is an enum, so plotting it needs a number.
 *
 * This is a judgement call and worth knowing about: "angry" and "anxious" are
 * unpleasant in different ways, and flattening them onto one axis loses that.
 * It is defensible for spotting trends, not for saying anything precise.
 */
const MOOD_SCORE: Record<string, number> = {
  happy: 5,
  motivated: 5,
  neutral: 3,
  tired: 2,
  anxious: 2,
  stressed: 2,
  sad: 1,
  angry: 1,
}

type DayMap = Map<string, { sum: number; count: number }>

function add(map: DayMap, date: string, value: number) {
  const key = date.slice(0, 10)
  const cur = map.get(key)
  if (cur) {
    cur.sum += value
    cur.count += 1
  } else {
    map.set(key, { sum: value, count: 1 })
  }
}

/** Summed per day: many rows make one number (meals, sets, transactions). */
function totals(map: DayMap) {
  const out = new Map<string, number>()
  for (const [date, { sum }] of map) out.set(date, sum)
  return out
}

/** Averaged per day: repeated readings of the same thing (weight, mood). */
function averages(map: DayMap) {
  const out = new Map<string, number>()
  for (const [date, { sum, count }] of map) out.set(date, sum / count)
  return out
}

export type SourceRows = {
  weight: WeightRow[]
  sleep: SleepRow[]
  nutrition: NutritionRow[]
  gym: GymRow[]
  transactions: TransactionRow[]
  journal: JournalRow[]
}

export function buildSeries(id: SeriesId, rows: SourceRows): Map<string, number> {
  const map: DayMap = new Map()

  switch (id) {
    case "weight":
      for (const r of rows.weight) {
        if (r.weight != null) add(map, r.date, r.weight)
      }
      return averages(map)

    case "sleepScore":
      for (const r of rows.sleep) {
        if (r.score != null) add(map, r.date, r.score)
      }
      return averages(map)

    case "sleepHours":
      for (const r of rows.sleep) {
        if (r.hours != null) add(map, r.date, r.hours)
      }
      return averages(map)

    case "calories":
      for (const r of rows.nutrition) {
        if (r.calories != null) add(map, r.date, r.calories)
      }
      return totals(map)

    case "protein":
      for (const r of rows.nutrition) {
        if (r.protein != null) add(map, r.date, r.protein)
      }
      return totals(map)

    case "volume":
      // Sets x reps x load is the standard proxy for how much work a session
      // was. Bodyweight rows have no load, so they contribute reps only.
      for (const r of rows.gym) {
        const sets = r.sets ?? 0
        const reps = r.reps ?? 0
        const load = r.unit === "bodyweight" ? 1 : r.weight ?? 0
        const work = sets * reps * load
        if (work > 0) add(map, r.date, work)
      }
      return totals(map)

    case "spend":
      for (const r of rows.transactions) {
        if (r.transaction_type === "expense" && r.amount != null) {
          add(map, r.date, Math.abs(r.amount))
        }
      }
      return totals(map)

    case "mood":
      for (const r of rows.journal) {
        const score = r.mood ? MOOD_SCORE[r.mood] : undefined
        if (score != null) add(map, r.date, score)
      }
      return averages(map)
  }
}

/** ISO day keys from `from` to `to` inclusive, so gaps in logging still plot. */
export function dayRange(days: number): string[] {
  const out: string[] = []
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/**
 * Rolling average.
 *
 * Raw daily weight and calories are noisy enough to bury any real
 * relationship — a 7-day window is what makes one visible. Nulls are skipped
 * rather than counted as zero, so a missed day does not drag the line down.
 */
export function smooth(
  values: (number | null)[],
  window: number
): (number | null)[] {
  if (window <= 1) return values

  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    let sum = 0
    let count = 0
    for (let j = start; j <= i; j++) {
      const v = values[j]
      if (v != null) {
        sum += v
        count += 1
      }
    }
    return count === 0 ? null : sum / count
  })
}

export type ChartPoint = { date: string } & Partial<Record<SeriesId, number | null>>

/** One row per day, with a key per selected series — the shape recharts wants. */
export function chartData(
  ids: SeriesId[],
  rows: SourceRows,
  days: number,
  window: number
): ChartPoint[] {
  const dates = dayRange(days)
  const built = ids.map((id) => {
    // Built once per series, not once per day — buildSeries walks every row
    // it is given, so calling it inside the date loop would be O(days x rows).
    const byDay = buildSeries(id, rows)
    return {
      id,
      values: smooth(
        dates.map((d) => byDay.get(d) ?? null),
        window
      ),
    }
  })

  return dates.map((date, i) => {
    const point: ChartPoint = { date }
    for (const s of built) point[s.id] = s.values[i]
    return point
  })
}
