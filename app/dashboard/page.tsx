import { redirect } from "next/navigation"
import { BookOpen, Dumbbell, Scale, Utensils, Wallet } from "lucide-react"

import { CheckinCalendar } from "@/components/dashboard/checkin-calendar"
import { DashboardSections } from "@/components/dashboard/dashboard-sections"
import { GymSection } from "@/components/dashboard/gym-section"
import { JournalSection } from "@/components/dashboard/journal-section"
import { MoneySection } from "@/components/dashboard/money-section"
import { NutritionSection } from "@/components/dashboard/nutrition-section"
import { WeightSection } from "@/components/dashboard/weight-section"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  accountActivity,
  activeSubscriptionsMonthly,
  categorySpend,
  dailyGymVolume,
  dailyNutrition,
  latestMood,
  monthlyMoney,
  moneyTotalsThisMonth,
  moodCounts,
  paymentMethodTotals,
  nutritionToday,
  recentPRs,
  weightChange,
  weightSeries,
  workoutsThisWeek,
} from "@/lib/stats"
import { createClient } from "@/lib/supabase/server"
import type {
  AccountRow,
  GymRow,
  JournalRow,
  NutritionRow,
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

  // Catch up any subscriptions whose due_date has passed: generate the
  // matching transactions and advance the schedule. Idempotent — if
  // nothing's due, it's a no-op.
  await supabase.rpc("advance_due_subscriptions")

  const [transactions, accounts, subscriptions, nutrition, gym, journal, weight] =
    await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, date, amount, category, transaction_type, description, payment_method, account_id"
      )
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
    supabase
      .from("accounts")
      .select(
        "id, name, account_type, institution, last_four, credit_limit, credit_used, payment_due_date, notes"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("subscriptions")
      .select(
        "id, name, amount, billing_cycle, category, account_id, due_date, is_active, notes"
      )
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("nutrition")
      .select(
        "id, date, meal_type, food_name, calories, protein, carbs, fat, portion_size, restaurant, notes"
      )
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
    supabase
      .from("gym_weight")
      .select(
        "id, date, workout_name, exercise, sets, reps, weight, unit, personal_record, notes"
      )
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
    supabase
      .from("journal")
      .select("id, date, title, entry, mood, tags")
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
    supabase
      .from("personal_weight")
      .select("id, date, weight, unit, body_fat, waist, chest, arms, legs, notes")
      .eq("user_id", user.id)
      .order("date", { ascending: true }),
  ])

  const transactionRows = (transactions.data ?? []) as TransactionRow[]
  const accountRows = (accounts.data ?? []) as AccountRow[]
  const subscriptionRows = (subscriptions.data ?? []) as SubscriptionRow[]
  const nutritionRows = (nutrition.data ?? []) as NutritionRow[]
  const gymRows = (gym.data ?? []) as GymRow[]
  const journalRows = (journal.data ?? []) as JournalRow[]
  const weightRows = (weight.data ?? []) as WeightRow[]

  const totals = moneyTotalsThisMonth(transactionRows)
  const subsMonthly = activeSubscriptionsMonthly(subscriptionRows)
  const today = nutritionToday(nutritionRows)
  const weekWorkouts = workoutsThisWeek(gymRows)
  const series = weightSeries(weightRows)
  const change = weightChange(series)
  const mood = latestMood(journalRows)
  const latestWeighIn =
    weightRows.length > 0 ? weightRows[weightRows.length - 1] : null

  return (
    <DashboardSections
      views={{
        overview: (
          <div className="space-y-6">
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
            <CheckinCalendar />
          </div>
        ),
        money: (
          <MoneySection
            monthly={monthlyMoney(transactionRows)}
            categoriesThisMonth={categorySpend(transactionRows, 0)}
            categoriesLastMonth={categorySpend(transactionRows, 1)}
            methodsThisMonth={paymentMethodTotals(transactionRows, 0)}
            methodsLastMonth={paymentMethodTotals(transactionRows, 1)}
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
            daily={dailyNutrition(nutritionRows)}
            recent={nutritionRows.slice(0, 10)}
          />
        ),
        gym: (
          <GymSection
            volume={dailyGymVolume(gymRows)}
            prs={recentPRs(gymRows)}
            recent={gymRows.slice(0, 10)}
          />
        ),
        weight: <WeightSection series={series} latest={latestWeighIn} />,
        journal: (
          <JournalSection
            moods={moodCounts(journalRows)}
            recent={journalRows.slice(0, 5)}
          />
        ),
      }}
    />
  )
}
