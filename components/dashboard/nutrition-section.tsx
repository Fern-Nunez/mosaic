"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts"

import { lastNDayKeys, todayKey, type DailyNutrition } from "@/lib/stats"
import type { NutritionRow } from "@/lib/types"
import { MealSnap } from "@/components/dashboard/meal-snap"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const nutritionConfig = {
  calories: { label: "Calories", color: "var(--chart-1)" },
  protein: { label: "Protein (g)", color: "var(--chart-2)" },
  carbs: { label: "Carbs (g)", color: "var(--chart-3)" },
  fat: { label: "Fat (g)", color: "var(--chart-4)" },
} satisfies ChartConfig

// "Wed, Jul 9" for a YYYY-MM-DD key, parsed in local time.
function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export function NutritionSection({
  daily,
  meals,
  userId,
}: {
  daily: DailyNutrition[]
  meals: NutritionRow[]
  userId: string
}) {
  const [day, setDay] = React.useState(() => todayKey())

  // Today through one week back, newest first.
  const dayOptions = React.useMemo(() => {
    return lastNDayKeys(8)
      .reverse()
      .map((key, index) => ({
        key,
        label:
          index === 0 ? "Today" : index === 1 ? "Yesterday" : dayLabel(key),
      }))
  }, [])

  const dayMeals = meals.filter((m) => m.date === day)
  const totals = dayMeals.reduce(
    (sum, m) => ({
      calories: sum.calories + (Number(m.calories) || 0),
      protein: sum.protein + (Number(m.protein) || 0),
    }),
    { calories: 0, protein: 0 }
  )
  const selectedLabel =
    dayOptions.find((option) => option.key === day)?.label ?? dayLabel(day)

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-end gap-2">
        <Select
          value={day}
          onValueChange={(value) => {
            if (value !== null) setDay(value)
          }}
        >
          <SelectTrigger className="w-40">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dayOptions.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MealSnap userId={userId} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Calories & macros</CardTitle>
          <CardDescription>
            Macros in grams (bars, left) and calories (line, right) — last 14
            days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={nutritionConfig} className="h-72 w-full">
            <ComposedChart accessibilityLayer data={daily}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="grams"
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <YAxis
                yAxisId="calories"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                yAxisId="grams"
                dataKey="protein"
                stackId="macros"
                fill="var(--color-protein)"
              />
              <Bar
                yAxisId="grams"
                dataKey="carbs"
                stackId="macros"
                fill="var(--color-carbs)"
              />
              <Bar
                yAxisId="grams"
                dataKey="fat"
                stackId="macros"
                fill="var(--color-fat)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="calories"
                dataKey="calories"
                type="monotone"
                stroke="var(--color-calories)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meals · {selectedLabel}</CardTitle>
          <CardDescription>
            {dayMeals.length === 0
              ? "Nothing logged on this day."
              : `${totals.calories.toLocaleString()} cal · ${Math.round(totals.protein)}g protein · ${dayMeals.length} ${dayMeals.length === 1 ? "entry" : "entries"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dayMeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No meals logged {selectedLabel === "Today" ? "yet today" : "on this day"}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meal</TableHead>
                  <TableHead>Food</TableHead>
                  <TableHead className="text-right">Calories</TableHead>
                  <TableHead className="text-right">Protein</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayMeals.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {m.meal_type ?? "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {m.food_name}
                      {m.restaurant ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {m.restaurant}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.calories ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.protein != null ? `${Number(m.protein)}g` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
