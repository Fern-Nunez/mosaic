import type {
  GymRow,
  JournalRow,
  MoneyRow,
  NutritionRow,
  WeightRow,
} from "@/lib/types"

/** "2026-07-07" for a Date, in local time. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** Date keys for the last `n` days, oldest first, including today. */
export function lastNDayKeys(n: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    keys.push(toDateKey(d))
  }
  return keys
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" })
}

function shortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  })
}

// ---------- Money ----------

export type MonthlyMoney = { month: string; income: number; expenses: number }

export function monthlyMoney(rows: MoneyRow[], months = 6): MonthlyMoney[] {
  const now = new Date()
  const buckets: { key: string; income: number; expenses: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: toDateKey(d).slice(0, 7), income: 0, expenses: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const row of rows) {
    const bucket = byKey.get(row.date.slice(0, 7))
    if (!bucket) continue
    const amount = Number(row.amount) || 0
    if (row.transaction_type === "income") bucket.income += amount
    else if (row.transaction_type === "expense") bucket.expenses += amount
  }
  return buckets.map((b) => ({
    month: monthLabel(b.key + "-01"),
    income: Math.round(b.income * 100) / 100,
    expenses: Math.round(b.expenses * 100) / 100,
  }))
}

export type CategorySpend = { category: string; total: number }

/**
 * Expense totals by category, largest first.
 * `monthOffset` is 0 for the current month, 1 for last month, etc.
 */
export function categorySpend(
  rows: MoneyRow[],
  monthOffset = 0
): CategorySpend[] {
  const now = new Date()
  const monthKey = toDateKey(
    new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
  ).slice(0, 7)
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.transaction_type !== "expense") continue
    if (!row.date.startsWith(monthKey)) continue
    const cat = row.category ?? "Other"
    totals.set(cat, (totals.get(cat) ?? 0) + (Number(row.amount) || 0))
  }
  return [...totals.entries()]
    .map(([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total)
}

export function moneyTotalsThisMonth(rows: MoneyRow[]) {
  const monthKey = todayKey().slice(0, 7)
  let income = 0
  let expenses = 0
  for (const row of rows) {
    if (!row.date.startsWith(monthKey)) continue
    const amount = Number(row.amount) || 0
    if (row.transaction_type === "income") income += amount
    else if (row.transaction_type === "expense") expenses += amount
  }
  return { income, expenses, net: income - expenses }
}

// ---------- Nutrition ----------

export type DailyNutrition = {
  date: string
  label: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export function dailyNutrition(rows: NutritionRow[], days = 14): DailyNutrition[] {
  const keys = lastNDayKeys(days)
  const byKey = new Map<string, DailyNutrition>(
    keys.map((k) => [
      k,
      { date: k, label: shortDate(k), calories: 0, protein: 0, carbs: 0, fat: 0 },
    ])
  )
  for (const row of rows) {
    const bucket = byKey.get(row.date)
    if (!bucket) continue
    bucket.calories += Number(row.calories) || 0
    bucket.protein += Number(row.protein) || 0
    bucket.carbs += Number(row.carbs) || 0
    bucket.fat += Number(row.fat) || 0
  }
  return keys.map((k) => byKey.get(k)!)
}

export function nutritionToday(rows: NutritionRow[]) {
  const today = todayKey()
  let calories = 0
  let protein = 0
  let meals = 0
  for (const row of rows) {
    if (row.date !== today) continue
    calories += Number(row.calories) || 0
    protein += Number(row.protein) || 0
    meals++
  }
  return { calories, protein: Math.round(protein), meals }
}

// ---------- Gym ----------

export type DailyVolume = { date: string; label: string; volume: number; sets: number }

/** Training volume (sets × reps × weight) per day over the last `days` days. */
export function dailyGymVolume(rows: GymRow[], days = 30): DailyVolume[] {
  const keys = lastNDayKeys(days)
  const byKey = new Map<string, DailyVolume>(
    keys.map((k) => [k, { date: k, label: shortDate(k), volume: 0, sets: 0 }])
  )
  for (const row of rows) {
    const bucket = byKey.get(row.date)
    if (!bucket) continue
    const sets = Number(row.sets) || 0
    const reps = Number(row.reps) || 0
    const weight = Number(row.weight) || 0
    bucket.volume += sets * reps * weight
    bucket.sets += sets
  }
  return keys.map((k) => byKey.get(k)!)
}

export function workoutsThisWeek(rows: GymRow[]): number {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const mondayKey = toDateKey(monday)
  const days = new Set<string>()
  for (const row of rows) {
    if (row.date >= mondayKey) days.add(row.date)
  }
  return days.size
}

export function recentPRs(rows: GymRow[], limit = 5): GymRow[] {
  return rows
    .filter((r) => r.personal_record)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}

// ---------- Body weight ----------

export type WeightPoint = { date: string; label: string; weight: number }

export function weightSeries(rows: WeightRow[]): WeightPoint[] {
  return rows
    .filter((r) => r.weight != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date,
      label: shortDate(r.date),
      weight: Number(r.weight),
    }))
}

export function weightChange(series: WeightPoint[], days = 30) {
  if (series.length === 0) return null
  const latest = series[series.length - 1]
  const cutoff = lastNDayKeys(days)[0]
  const baseline = series.find((p) => p.date >= cutoff) ?? series[0]
  return {
    latest: latest.weight,
    change: Math.round((latest.weight - baseline.weight) * 10) / 10,
  }
}

// ---------- Journal ----------

export type MoodCount = { mood: string; count: number }

export function moodCounts(rows: JournalRow[], days = 30): MoodCount[] {
  const cutoff = lastNDayKeys(days)[0]
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.date < cutoff) continue
    const mood = row.mood ?? "unknown"
    counts.set(mood, (counts.get(mood) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([mood, count]) => ({ mood, count }))
    .sort((a, b) => b.count - a.count)
}

export function latestMood(rows: JournalRow[]): string | null {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  return sorted[0]?.mood ?? null
}
