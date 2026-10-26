import { cookies } from "next/headers"

import { TodayHeader } from "@/components/app/today-header"
import { TodayOverview, type TodayData } from "@/components/app/today-overview"
import { DEFAULT_NUTRITION_GOALS, toDateKey } from "@/lib/stats"
import { createClient } from "@/lib/supabase/server"

export default async function TodayPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Uses a name from the sign-up metadata if one was ever saved.
  const meta = user.user_metadata ?? {}
  const fullName: string | undefined = meta.first_name ?? meta.full_name ?? meta.name
  const firstName = fullName?.trim().split(/\s+/)[0] ?? null

  const workspace = (await cookies()).get("mosaic-workspace")?.value ?? "personal"

  // The server's clock may be in a different time zone than the phone (UTC
  // on Vercel), so fetch the last few days and let the client pick "today".
  const since = new Date()
  since.setDate(since.getDate() - 3)
  const sinceKey = toDateKey(since)
  // Money shows the whole month. Start from the 1st of the month as of
  // yesterday, so the phone's month is covered even across time zones.
  const monthStart = new Date()
  monthStart.setDate(monthStart.getDate() - 1)
  monthStart.setDate(1)
  const monthStartKey = toDateKey(monthStart)

  const [nutrition, transactions, gym, runs, cardio, sleep, journal, weight, settings] =
    await Promise.all([
      supabase
        .from("nutrition")
        .select("id, date, meal_type, food_name, calories, protein")
        .eq("user_id", user.id)
        .eq("workspace", workspace)
        .gte("date", sinceKey),
      supabase
        .from("transactions")
        .select("id, date, amount, transaction_type, description, category")
        .eq("user_id", user.id)
        .eq("workspace", workspace)
        .gte("date", monthStartKey < sinceKey ? monthStartKey : sinceKey),
      supabase
        .from("gym_weight")
        .select("id, date, exercise, sets, reps, weight, unit")
        .eq("user_id", user.id)
        .eq("workspace", workspace)
        .gte("date", sinceKey),
      supabase
        .from("runs")
        .select("id, date, distance_miles, duration_seconds")
        .eq("user_id", user.id)
        .eq("workspace", workspace)
        .gte("date", sinceKey),
      // Bike rides and swims (empty until the cardio SQL is run).
      supabase
        .from("cardio")
        .select("id, date, activity, distance, distance_unit, duration_seconds")
        .eq("user_id", user.id)
        .eq("workspace", workspace)
        .gte("date", sinceKey),
      supabase
        .from("sleep")
        .select("id, date, score, hours")
        .eq("user_id", user.id)
        .eq("workspace", workspace)
        .gte("date", sinceKey),
      supabase
        .from("journal")
        .select("id, date, title, mood")
        .eq("user_id", user.id)
        .eq("workspace", workspace)
        .gte("date", sinceKey),
      // The last 7 weigh-ins, whenever they were.
      supabase
        .from("personal_weight")
        .select("id, date, weight, unit")
        .eq("user_id", user.id)
        .eq("workspace", workspace)
        .not("weight", "is", null)
        .order("date", { ascending: false })
        .limit(7),
      supabase
        .from("user_settings")
        .select("calorie_goal, protein_goal")
        .eq("user_id", user.id)
        .maybeSingle(),
    ])

  // Missing tables (migration not run) just come back empty.
  const data: TodayData = {
    nutrition: (nutrition.data ?? []) as TodayData["nutrition"],
    transactions: (transactions.data ?? []) as TodayData["transactions"],
    gym: (gym.data ?? []) as TodayData["gym"],
    runs: (runs.data ?? []) as TodayData["runs"],
    cardio: (cardio.data ?? []) as TodayData["cardio"],
    sleep: (sleep.data ?? []) as TodayData["sleep"],
    journal: (journal.data ?? []) as TodayData["journal"],
    // Oldest first, for the chart.
    weights: ((weight.data ?? []) as TodayData["weights"]).slice().reverse(),
    goals: {
      calories: settings.data?.calorie_goal ?? DEFAULT_NUTRITION_GOALS.calories,
      protein: settings.data?.protein_goal ?? DEFAULT_NUTRITION_GOALS.protein,
    },
  }

  return (
    <div className="flex flex-col gap-8">
      <TodayHeader name={firstName} />
      <TodayOverview data={data} />
    </div>
  )
}
