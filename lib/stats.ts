import type {
  AccountRow,
  GymRow,
  JournalRow,
  NutritionRow,
  SubscriptionRow,
  TransactionRow,
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

export function monthlyMoney(
  rows: TransactionRow[],
  months = 6
): MonthlyMoney[] {
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
    else bucket.expenses += amount
  }
  return buckets.map((b) => ({
    month: monthLabel(b.key + "-01"),
    income: Math.round(b.income * 100) / 100,
    expenses: Math.round(b.expenses * 100) / 100,
  }))
}

export type CategorySpend = { category: string; total: number }

/**
 * Net expense totals by category, largest first. Zelle *income* is
 * subtracted from the category — treated as a reimbursement (a friend
 * paying you back for their share of dinner reduces your Food spend).
 * Categories that end up at or below zero are filtered out.
 * `monthOffset` is 0 for the current month, 1 for last month, etc.
 */
export function categorySpend(
  rows: TransactionRow[],
  monthOffset = 0
): CategorySpend[] {
  const now = new Date()
  const monthKey = toDateKey(
    new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
  ).slice(0, 7)
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (!row.date.startsWith(monthKey)) continue
    const cat = row.category ?? "Other"
    const amount = Number(row.amount) || 0
    if (row.transaction_type === "expense") {
      totals.set(cat, (totals.get(cat) ?? 0) + amount)
    } else if (
      row.transaction_type === "income" &&
      row.payment_method === "zelle"
    ) {
      totals.set(cat, (totals.get(cat) ?? 0) - amount)
    }
  }
  return [...totals.entries()]
    .map(([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100,
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
}

export type PaymentMethodTotals = {
  method: string
  received: number
  sent: number
  net: number
}

/**
 * Income (received) and expense (sent) totals by payment method,
 * e.g. Zelle vs. Credit Card.
 * `monthOffset` is 0 for the current month, 1 for last month, etc.
 */
export function paymentMethodTotals(
  rows: TransactionRow[],
  monthOffset = 0
): PaymentMethodTotals[] {
  const now = new Date()
  const monthKey = toDateKey(
    new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
  ).slice(0, 7)
  const totals = new Map<string, { received: number; sent: number }>()
  for (const row of rows) {
    if (!row.date.startsWith(monthKey)) continue
    const method = row.payment_method?.trim() || "Other"
    const entry = totals.get(method) ?? { received: 0, sent: 0 }
    const amount = Number(row.amount) || 0
    if (row.transaction_type === "income") entry.received += amount
    else entry.sent += amount
    totals.set(method, entry)
  }
  return [...totals.entries()]
    .map(([method, t]) => ({
      method,
      received: Math.round(t.received * 100) / 100,
      sent: Math.round(t.sent * 100) / 100,
      net: Math.round((t.received - t.sent) * 100) / 100,
    }))
    .sort((a, b) => b.received + b.sent - (a.received + a.sent))
}

export type AccountActivity = AccountRow & {
  moneyIn: number
  moneyOut: number
}

/**
 * Money in and out of each account for a month. Expenses count against
 * the account; income counts toward it.
 * `monthOffset` is 0 for the current month, 1 for last month, etc.
 */
export function accountActivity(
  rows: TransactionRow[],
  accounts: AccountRow[],
  monthOffset = 0
): AccountActivity[] {
  const now = new Date()
  const monthKey = toDateKey(
    new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
  ).slice(0, 7)
  const byId = new Map<string, AccountActivity>(
    accounts.map((a) => [a.id, { ...a, moneyIn: 0, moneyOut: 0 }])
  )
  for (const row of rows) {
    if (!row.date.startsWith(monthKey)) continue
    if (!row.account_id) continue
    const account = byId.get(row.account_id)
    if (!account) continue
    const amount = Number(row.amount) || 0
    if (row.transaction_type === "income") account.moneyIn += amount
    else account.moneyOut += amount
  }
  return [...byId.values()].map((a) => ({
    ...a,
    moneyIn: Math.round(a.moneyIn * 100) / 100,
    moneyOut: Math.round(a.moneyOut * 100) / 100,
  }))
}

export function moneyTotalsThisMonth(rows: TransactionRow[]) {
  const monthKey = todayKey().slice(0, 7)
  let income = 0
  let expenses = 0
  for (const row of rows) {
    if (!row.date.startsWith(monthKey)) continue
    const amount = Number(row.amount) || 0
    if (row.transaction_type === "income") income += amount
    else expenses += amount
  }
  return { income, expenses, net: income - expenses }
}

/**
 * Normalize any subscription cost to what it works out to per month,
 * so mixed-cycle subscriptions can be summed for a monthly total.
 */
export function subscriptionMonthlyCost(sub: SubscriptionRow): number {
  const amount = Number(sub.amount) || 0
  switch (sub.billing_cycle) {
    case "weekly":
      return amount * 4.345
    case "monthly":
      return amount
    case "quarterly":
      return amount / 3
    case "yearly":
      return amount / 12
  }
}

export function activeSubscriptionsMonthly(rows: SubscriptionRow[]): number {
  const total = rows
    .filter((s) => s.is_active)
    .reduce((sum, s) => sum + subscriptionMonthlyCost(s), 0)
  return Math.round(total * 100) / 100
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

export type NutritionGoals = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

// Default daily targets used until the user sets their own (and the
// fallback when the goals columns/row aren't present yet). Set for a lean
// bulk from ~126 lbs toward 160 lbs — a calorie surplus with high protein.
export const DEFAULT_NUTRITION_GOALS: NutritionGoals = {
  calories: 2800,
  protein: 160,
  carbs: 380,
  fat: 70,
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
