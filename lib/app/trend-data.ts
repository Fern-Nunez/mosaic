// Loads everything the Trends tab and category pages chart. Server-only:
// call it from a server component with the server Supabase client.

import type { SupabaseClient } from "@supabase/supabase-js"

import type { TxType } from "@/lib/app/money"
import { readPrefs, type AppPrefs } from "@/lib/app/prefs"
import type { CardioActivity } from "@/lib/app/workouts"
import { DEFAULT_NUTRITION_GOALS } from "@/lib/stats"
import { dateKey, earliestNeeded, shiftKey, type RangeId } from "@/lib/app/dates"

export const TREND_CATEGORIES = [
  "money",
  "nutrition",
  "workout",
  "weight",
  "sleep",
  "journal",
  "habits",
  "supplements",
] as const

export type TrendCategory = (typeof TREND_CATEGORIES)[number]

export function isTrendCategory(value: string): value is TrendCategory {
  return (TREND_CATEGORIES as readonly string[]).includes(value)
}

export type TrendData = {
  transactions: { id: string; date: string; amount: number; transaction_type: TxType; category: string | null; description: string | null; payment_method: string | null }[]
  nutrition: { id: string; date: string; meal_type: string | null; food_name: string; calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null }[]
  gym: { id: string; date: string; exercise: string; sets: number | null; reps: number | null; weight: number | null; unit: string | null }[]
  runs: { id: string; date: string; distance_miles: number; duration_seconds: number }[]
  /** Rides, swims, walks and hikes. Empty until the cardio migration is run. */
  cardio: { id: string; date: string; activity: CardioActivity; distance: number | null; distance_unit: string | null; duration_seconds: number | null }[]
  cardioReady: boolean
  sleep: { id: string; date: string; hours: number | null; score: number | null }[]
  journal: { id: string; date: string; title: string | null; entry: string; mood: string | null }[]
  /** Weigh-ins in the window plus the one right before it, oldest first. */
  weights: { id: string; date: string; weight: number; unit: string | null }[]
  supplements: { id: string; date: string; name: string; dose: number | null; unit: string | null }[]
  /** Active supplements in the user's stack. */
  stack: { id: string; name: string; dose: number | null; unit: string | null; timing: string | null }[]
  /** False when the supplements migration hasn't been run yet. */
  supplementsReady: boolean
  goals: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  /** How generous the meal-photo estimate is ("low" | "middle" | "high"). */
  estimateLevel: string
  /** Category settings from the gear menu. */
  prefs: AppPrefs
  /** False until the app_prefs migration has been run. */
  prefsReady: boolean
}

/**
 * Fetches the current period and the one before it (for the "vs this time
 * last month" numbers).
 */
export async function loadTrendData(
  supabase: SupabaseClient,
  userId: string,
  workspace: string,
  range: RangeId,
  only?: string
): Promise<TrendData> {
  // Based on the server's yesterday, since its clock can be a day ahead of
  // the phone (UTC on Vercel), plus two days of slack.
  const serverYesterday = shiftKey(dateKey(new Date()), -1)
  // At least the last 9 days, so "this week" (Sunday on) works on the D range too.
  const rangeSince = shiftKey(earliestNeeded(serverYesterday, range), -2)
  const weekSince = shiftKey(serverYesterday, -8)
  const sinceKey = rangeSince < weekSince ? rangeSince : weekSince
  const want = (c: string) => !only || only === c

  const scoped = (table: string, columns: string) =>
    supabase
      .from(table)
      .select(columns)
      .eq("user_id", userId)
      .eq("workspace", workspace)
      .gte("date", sinceKey)
      .order("date", { ascending: true })

  const empty = Promise.resolve({ data: [], error: null })

  const [transactions, nutrition, gym, runs, cardio, sleep, journal, weights, before, supplements, stack, settings] =
    await Promise.all([
      want("money") ? scoped("transactions", "id, date, amount, transaction_type, category, description, payment_method") : empty,
      want("nutrition") ? scoped("nutrition", "id, date, meal_type, food_name, calories, protein, carbs, fat, fiber") : empty,
      want("workout") ? scoped("gym_weight", "id, date, exercise, sets, reps, weight, unit") : empty,
      want("workout") ? scoped("runs", "id, date, distance_miles, duration_seconds") : empty,
      want("workout") ? scoped("cardio", "id, date, activity, distance, distance_unit, duration_seconds") : empty,
      want("sleep") ? scoped("sleep", "id, date, hours, score") : empty,
      want("journal") ? scoped("journal", "id, date, title, entry, mood") : empty,
      want("weight")
        ? scoped("personal_weight", "id, date, weight, unit").not("weight", "is", null)
        : empty,
      // The last weigh-in before the window, so "change" has a baseline.
      want("weight")
        ? supabase
            .from("personal_weight")
            .select("id, date, weight, unit")
            .eq("user_id", userId)
            .eq("workspace", workspace)
            .lt("date", sinceKey)
            .not("weight", "is", null)
            .order("date", { ascending: false })
            .limit(1)
        : empty,
      want("supplements")
        ? scoped("supplement_logs", "id, date, name, dose, unit")
        : empty,
      want("supplements")
        ? supabase
            .from("supplements")
            .select("id, name, dose, unit, timing")
            .eq("user_id", userId)
            .eq("workspace", workspace)
            .eq("is_active", true)
            .order("position", { ascending: true })
        : empty,
      // "*" so this still works before newer columns (app_prefs) exist.
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    ])

  const rows = <T,>(res: { data: unknown }) => (Array.isArray(res.data) ? (res.data as T[]) : [])
  const num = (v: unknown) => (v == null ? null : Number(v))
  const goals = (settings.data ?? {}) as {
    calorie_goal?: number | null
    protein_goal?: number | null
    carb_goal?: number | null
    fat_goal?: number | null
    fiber_goal?: number | null
    estimate_level?: string | null
    app_prefs?: unknown
  }

  return {
    transactions: rows<TrendData["transactions"][number]>(transactions).map((t) => ({ ...t, amount: Number(t.amount) })),
    nutrition: rows<TrendData["nutrition"][number]>(nutrition).map((n) => ({
      ...n,
      calories: num(n.calories),
      protein: num(n.protein),
      carbs: num(n.carbs),
      fat: num(n.fat),
      fiber: num(n.fiber),
    })),
    gym: rows<TrendData["gym"][number]>(gym).map((g) => ({ ...g, weight: num(g.weight) })),
    runs: rows<TrendData["runs"][number]>(runs).map((r) => ({ ...r, distance_miles: Number(r.distance_miles) })),
    cardio: rows<TrendData["cardio"][number]>(cardio).map((c) => ({ ...c, distance: num(c.distance) })),
    cardioReady: !cardio.error,
    sleep: rows<TrendData["sleep"][number]>(sleep).map((s) => ({ ...s, hours: num(s.hours) })),
    journal: rows<TrendData["journal"][number]>(journal),
    weights: [...rows<TrendData["weights"][number]>(before), ...rows<TrendData["weights"][number]>(weights)].map((w) => ({
      ...w,
      weight: Number(w.weight),
    })),
    supplements: rows<TrendData["supplements"][number]>(supplements).map((s) => ({ ...s, dose: num(s.dose) })),
    supplementsReady: !supplements.error,
    stack: rows<TrendData["stack"][number]>(stack).map((s) => ({ ...s, dose: num(s.dose) })),
    goals: {
      calories: goals.calorie_goal ?? DEFAULT_NUTRITION_GOALS.calories,
      protein: goals.protein_goal ?? DEFAULT_NUTRITION_GOALS.protein,
      carbs: goals.carb_goal ?? DEFAULT_NUTRITION_GOALS.carbs,
      fat: goals.fat_goal ?? DEFAULT_NUTRITION_GOALS.fat,
      fiber: goals.fiber_goal ?? DEFAULT_NUTRITION_GOALS.fiber,
    },
    estimateLevel: goals.estimate_level ?? "low",
    prefs: readPrefs(goals.app_prefs),
    prefsReady: settings.data ? "app_prefs" in settings.data : true,
  }
}
