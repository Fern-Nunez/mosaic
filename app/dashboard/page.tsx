import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { BookOpen, Dumbbell, Scale, Utensils, Wallet } from "lucide-react"

import { DashboardSections } from "@/components/dashboard/dashboard-sections"
import { GymSection } from "@/components/dashboard/gym-section"
import { HabitsSection } from "@/components/dashboard/habits-section"
import { JobsSection } from "@/components/dashboard/jobs-section"
import { JournalSection } from "@/components/dashboard/journal-section"
import { MoneySection } from "@/components/dashboard/money-section"
import { NutritionSection } from "@/components/dashboard/nutrition-section"
import { OverlayChart } from "@/components/dashboard/overlay-chart"
import { SleepSection } from "@/components/dashboard/sleep-section"
import { WeightSection } from "@/components/dashboard/weight-section"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  accountActivity,
  activeSubscriptionsMonthly,
  categorySpend,
  dailyNutrition,
  DEFAULT_ESTIMATE_LEVEL,
  DEFAULT_NUTRITION_GOALS,
  lastNDayKeys,
  latestMood,
  monthlyMoney,
  moneyTotalsThisMonth,
  nutritionToday,
  weightChange,
  weightSeries,
  workoutsThisWeek,
  type EstimateLevel,
} from "@/lib/stats"
import { createClient } from "@/lib/supabase/server"
import type {
  AccountRow,
  GymRow,
  JobApplicationRow,
  JournalRow,
  NutritionRow,
  SleepRow,
  SubscriptionRow,
  TransactionRow,
  WeightRow,
} from "@/lib/types"

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

type StatAccent = "emerald" | "amber" | "indigo" | "violet" | "rose"

const STAT_ACCENTS: Record<StatAccent, string> = {
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  indigo: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
  accent: StatAccent
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            STAT_ACCENTS[accent]
          )}
        >
          <Icon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold tabular-nums">{value}</p>
          {hint && (
            <p className="truncate text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Which dashboard (workspace) is active — the switcher sets this cookie
  // and refreshes, so every query below is scoped to one dashboard.
  const cookieStore = await cookies()
  const workspace = cookieStore.get("mosaic-workspace")?.value ?? "personal"

  // Catch up any subscriptions whose due_date has passed: generate the
  // matching transactions and advance the schedule. Idempotent — if
  // nothing's due, it's a no-op.
  await supabase.rpc("advance_due_subscriptions")

  const [
    transactions,
    accounts,
    subscriptions,
    nutrition,
    gym,
    journal,
    weight,
    jobs,
    sleep,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, date, amount, category, transaction_type, description, payment_method, account_id"
      )
      .eq("user_id", user.id)
      .eq("workspace", workspace)
      .order("date", { ascending: false }),
    supabase
      .from("accounts")
      .select(
        "id, name, account_type, institution, last_four, credit_limit, credit_used, payment_due_date, notes"
      )
      .eq("user_id", user.id)
      .eq("workspace", workspace)
      .order("created_at", { ascending: true }),
    supabase
      .from("subscriptions")
      .select(
        "id, name, amount, billing_cycle, category, account_id, due_date, is_active, notes"
      )
      .eq("user_id", user.id)
      .eq("workspace", workspace)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("nutrition")
      .select(
        "id, date, meal_type, food_name, calories, protein, carbs, fat, fiber, portion_size, restaurant, notes"
      )
      .eq("user_id", user.id)
      .eq("workspace", workspace)
      .order("date", { ascending: false }),
    supabase
      .from("gym_weight")
      .select(
        "id, date, workout_name, exercise, sets, reps, weight, unit, personal_record, notes"
      )
      .eq("user_id", user.id)
      .eq("workspace", workspace)
      .order("date", { ascending: false }),
    supabase
      .from("journal")
      .select("id, date, title, entry, mood, tags")
      .eq("user_id", user.id)
      .eq("workspace", workspace)
      .order("date", { ascending: false }),
    supabase
      .from("personal_weight")
      .select("id, date, weight, unit, body_fat, waist, chest, arms, legs, notes")
      .eq("user_id", user.id)
      .eq("workspace", workspace)
      .order("date", { ascending: true }),
    supabase
      .from("job_applications")
      .select(
        "id, position_title, company, pay, description, url, status, applied_date, notes"
      )
      .eq("user_id", user.id)
      .eq("workspace", workspace)
      .order("applied_date", { ascending: false }),
    supabase
      .from("sleep")
      .select("id, date, score, hours, bedtime, wake_time, notes")
      .eq("user_id", user.id)
      .eq("workspace", workspace)
      .order("date", { ascending: false }),
  ])

  // Daily nutrition goals live on user_settings so they sync across
  // devices. Read defensively: if the row or goal columns aren't there yet
  // (migration not applied), fall back to defaults so the tab still works.
  const { data: settingsData } = await supabase
    .from("user_settings")
    .select(
      "calorie_goal, protein_goal, carb_goal, fat_goal, fiber_goal, estimate_level"
    )
    .eq("user_id", user.id)
    .maybeSingle()

  const nutritionGoals = {
    calories: settingsData?.calorie_goal ?? DEFAULT_NUTRITION_GOALS.calories,
    protein: settingsData?.protein_goal ?? DEFAULT_NUTRITION_GOALS.protein,
    carbs: settingsData?.carb_goal ?? DEFAULT_NUTRITION_GOALS.carbs,
    fat: settingsData?.fat_goal ?? DEFAULT_NUTRITION_GOALS.fat,
    fiber: settingsData?.fiber_goal ?? DEFAULT_NUTRITION_GOALS.fiber,
  }

  const estimateLevel = (settingsData?.estimate_level ??
    DEFAULT_ESTIMATE_LEVEL) as EstimateLevel

  const transactionRows = (transactions.data ?? []) as TransactionRow[]
  const accountRows = (accounts.data ?? []) as AccountRow[]
  const subscriptionRows = (subscriptions.data ?? []) as SubscriptionRow[]
  const nutritionRows = (nutrition.data ?? []) as NutritionRow[]
  const gymRows = (gym.data ?? []) as GymRow[]
  const journalRows = (journal.data ?? []) as JournalRow[]
  const weightRows = (weight.data ?? []) as WeightRow[]
  // Falls back to empty when the sleep migration has not been run yet, so
  // the dashboard still loads rather than erroring on a missing table.
  const sleepRows = (sleep.data ?? []) as SleepRow[]
  const jobRows = (jobs.data ?? []) as JobApplicationRow[]

  const totals = moneyTotalsThisMonth(transactionRows)
  const subsMonthly = activeSubscriptionsMonthly(subscriptionRows)
  const today = nutritionToday(nutritionRows)
  const weekWorkouts = workoutsThisWeek(gymRows)
  const series = weightSeries(weightRows)
  const change = weightChange(series)
  const mood = latestMood(journalRows)

  return (
    <DashboardSections
      views={{
        overview: (
          <div className="flex h-full flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard
                icon={Wallet}
                accent="emerald"
                label="Net this month"
                value={usd.format(totals.net)}
                hint={`${usd.format(totals.income)} in · ${usd.format(totals.expenses)} out`}
              />
              <StatCard
                icon={Utensils}
                accent="amber"
                label="Calories today"
                value={today.calories.toLocaleString()}
                hint={`${today.protein}g protein · ${today.meals} ${today.meals === 1 ? "meal" : "meals"}`}
              />
              <StatCard
                icon={Dumbbell}
                accent="indigo"
                label="Gym days this week"
                value={String(weekWorkouts)}
                hint={weekWorkouts === 0 ? "Time to move" : "Keep it up"}
              />
              <StatCard
                icon={Scale}
                accent="violet"
                label="Current weight"
                value={change ? `${change.latest}` : "—"}
                hint={
                  change
                    ? `${change.change > 0 ? "+" : ""}${change.change} last 30 days`
                    : "No weigh-ins yet"
                }
              />
              <StatCard
                icon={BookOpen}
                accent="rose"
                label="Last mood"
                value={mood ? mood[0].toUpperCase() + mood.slice(1) : "—"}
                hint={`${journalRows.length} total entries`}
              />
            </div>

            <OverlayChart
              rows={{
                weight: weightRows,
                sleep: sleepRows,
                nutrition: nutritionRows,
                gym: gymRows,
                transactions: transactionRows,
                journal: journalRows,
              }}
            />
          </div>
        ),
        // Keyed by workspace so sections holding client state (journal
        // entries, weigh-ins, goals) remount with fresh data on switch.
        money: (
          <MoneySection
            key={workspace}
            monthly={monthlyMoney(transactionRows)}
            categoriesThisMonth={categorySpend(transactionRows, 0)}
            categoriesLastMonth={categorySpend(transactionRows, 1)}
            accounts={accountRows}
            accountsThisMonth={accountActivity(transactionRows, accountRows, 0)}
            accountsLastMonth={accountActivity(transactionRows, accountRows, 1)}
            subscriptions={subscriptionRows}
            subsMonthly={subsMonthly}
            recent={transactionRows.slice(0, 10)}
          />
        ),
        nutrition: (
          <NutritionSection
            key={workspace}
            daily={dailyNutrition(nutritionRows)}
            meals={nutritionRows.filter(
              (row) => row.date >= lastNDayKeys(8)[0]
            )}
            goals={nutritionGoals}
            estimateLevel={estimateLevel}
            userId={user.id}
          />
        ),
        gym: <GymSection key={workspace} rows={gymRows} userId={user.id} />,
        weight: (
          <WeightSection key={workspace} rows={weightRows} userId={user.id} />
        ),
        sleep: (
          <SleepSection key={workspace} rows={sleepRows} userId={user.id} />
        ),
        journal: (
          <JournalSection
            key={workspace}
            entries={journalRows}
            userId={user.id}
          />
        ),
        habits: <HabitsSection key={workspace} />,
        jobs: <JobsSection key={workspace} jobs={jobRows} userId={user.id} />,
      }}
    />
  )
}
