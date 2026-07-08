import { redirect } from "next/navigation"
import {
  BookOpen,
  Dumbbell,
  LayoutGrid,
  LogOut,
  Scale,
  Utensils,
  Wallet,
} from "lucide-react"

import { signout } from "@/app/login/actions"
import { GymSection } from "@/components/dashboard/gym-section"
import { JournalSection } from "@/components/dashboard/journal-section"
import { MoneySection } from "@/components/dashboard/money-section"
import { NutritionSection } from "@/components/dashboard/nutrition-section"
import { WeightSection } from "@/components/dashboard/weight-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  categorySpend,
  dailyGymVolume,
  dailyNutrition,
  latestMood,
  monthlyMoney,
  moneyTotalsThisMonth,
  moodCounts,
  nutritionToday,
  recentPRs,
  weightChange,
  weightSeries,
  workoutsThisWeek,
} from "@/lib/stats"
import { createClient } from "@/lib/supabase/server"
import type {
  GymRow,
  JournalRow,
  MoneyRow,
  NutritionRow,
  WeightRow,
} from "@/lib/types"

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4.5 text-muted-foreground" />
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

  const [money, nutrition, gym, journal, weight] = await Promise.all([
    supabase
      .from("money")
      .select("id, date, amount, category, transaction_type, description")
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
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

  const moneyRows = (money.data ?? []) as MoneyRow[]
  const nutritionRows = (nutrition.data ?? []) as NutritionRow[]
  const gymRows = (gym.data ?? []) as GymRow[]
  const journalRows = (journal.data ?? []) as JournalRow[]
  const weightRows = (weight.data ?? []) as WeightRow[]

  const totals = moneyTotalsThisMonth(moneyRows)
  const today = nutritionToday(nutritionRows)
  const weekWorkouts = workoutsThisWeek(gymRows)
  const series = weightSeries(weightRows)
  const change = weightChange(series)
  const mood = latestMood(journalRows)
  const latestWeighIn =
    weightRows.length > 0 ? weightRows[weightRows.length - 1] : null

  return (
    <div className="min-h-svh bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LayoutGrid className="size-4" />
            </div>
            <span className="font-semibold tracking-tight">Mosaic</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.email}
            </span>
            <form action={signout}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut data-icon="inline-start" className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your mosaic
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything you&apos;re tracking, in one place.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            icon={Wallet}
            label="Net this month"
            value={usd.format(totals.net)}
            hint={`${usd.format(totals.income)} in · ${usd.format(totals.expenses)} out`}
          />
          <StatCard
            icon={Utensils}
            label="Calories today"
            value={today.calories.toLocaleString()}
            hint={`${today.protein}g protein · ${today.meals} ${today.meals === 1 ? "meal" : "meals"}`}
          />
          <StatCard
            icon={Dumbbell}
            label="Gym days this week"
            value={String(weekWorkouts)}
            hint={weekWorkouts === 0 ? "Time to move" : "Keep it up"}
          />
          <StatCard
            icon={Scale}
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
            label="Last mood"
            value={mood ? mood[0].toUpperCase() + mood.slice(1) : "—"}
            hint={`${journalRows.length} total entries`}
          />
        </div>

        <Separator />

        <Tabs defaultValue="money">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="money">
              <Wallet data-icon="inline-start" className="size-4" />
              <span className="hidden sm:inline">Money</span>
            </TabsTrigger>
            <TabsTrigger value="nutrition">
              <Utensils data-icon="inline-start" className="size-4" />
              <span className="hidden sm:inline">Nutrition</span>
            </TabsTrigger>
            <TabsTrigger value="gym">
              <Dumbbell data-icon="inline-start" className="size-4" />
              <span className="hidden sm:inline">Gym</span>
            </TabsTrigger>
            <TabsTrigger value="weight">
              <Scale data-icon="inline-start" className="size-4" />
              <span className="hidden sm:inline">Weight</span>
            </TabsTrigger>
            <TabsTrigger value="journal">
              <BookOpen data-icon="inline-start" className="size-4" />
              <span className="hidden sm:inline">Journal</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="money" className="mt-4">
            <MoneySection
              monthly={monthlyMoney(moneyRows)}
              categoriesThisMonth={categorySpend(moneyRows, 0)}
              categoriesLastMonth={categorySpend(moneyRows, 1)}
              recent={moneyRows.slice(0, 10)}
            />
          </TabsContent>
          <TabsContent value="nutrition" className="mt-4">
            <NutritionSection
              daily={dailyNutrition(nutritionRows)}
              recent={nutritionRows.slice(0, 10)}
            />
          </TabsContent>
          <TabsContent value="gym" className="mt-4">
            <GymSection
              volume={dailyGymVolume(gymRows)}
              prs={recentPRs(gymRows)}
              recent={gymRows.slice(0, 10)}
            />
          </TabsContent>
          <TabsContent value="weight" className="mt-4">
            <WeightSection series={series} latest={latestWeighIn} />
          </TabsContent>
          <TabsContent value="journal" className="mt-4">
            <JournalSection
              moods={moodCounts(journalRows)}
              recent={journalRows.slice(0, 5)}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
