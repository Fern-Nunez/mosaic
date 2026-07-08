"use client"

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts"

import type { DailyNutrition } from "@/lib/stats"
import type { NutritionRow } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
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

export function NutritionSection({
  daily,
  recent,
}: {
  daily: DailyNutrition[]
  recent: NutritionRow[]
}) {
  return (
    <div className="grid gap-4">
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
          <CardTitle>Recent meals</CardTitle>
          <CardDescription>Your latest 10 entries</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No meals logged yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Meal</TableHead>
                  <TableHead>Food</TableHead>
                  <TableHead className="text-right">Calories</TableHead>
                  <TableHead className="text-right">Protein</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{m.date}</TableCell>
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
