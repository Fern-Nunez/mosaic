"use client"

import { useState } from "react"
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import type { CategorySpend, MonthlyMoney } from "@/lib/stats"
import type { MoneyRow } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
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

const monthlyConfig = {
  income: { label: "Income", color: "var(--chart-2)" },
  expenses: { label: "Expenses", color: "var(--chart-5)" },
} satisfies ChartConfig

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function MoneySection({
  monthly,
  categoriesThisMonth,
  categoriesLastMonth,
  recent,
}: {
  monthly: MonthlyMoney[]
  categoriesThisMonth: CategorySpend[]
  categoriesLastMonth: CategorySpend[]
  recent: MoneyRow[]
}) {
  const [period, setPeriod] = useState<"this" | "last">("this")
  const categories =
    period === "this" ? categoriesThisMonth : categoriesLastMonth

  const categoryConfig = Object.fromEntries(
    categories.map((c, i) => [
      c.category,
      { label: c.category, color: PIE_COLORS[i % PIE_COLORS.length] },
    ])
  ) satisfies ChartConfig

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Income vs. expenses</CardTitle>
          <CardDescription>Last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={monthlyConfig} className="h-64 w-full">
            <LineChart accessibilityLayer data={monthly}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
              />
              <YAxis tickLine={false} axisLine={false} width={50} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                dataKey="income"
                type="monotone"
                stroke="var(--color-income)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                dataKey="expenses"
                type="monotone"
                stroke="var(--color-expenses)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spending by category</CardTitle>
          <CardDescription>
            {period === "this" ? "This month" : "Last month"}
          </CardDescription>
          <CardAction>
            <div className="flex rounded-lg bg-muted p-0.5">
              <Button
                size="xs"
                variant={period === "this" ? "outline" : "ghost"}
                className={period === "this" ? "shadow-xs" : ""}
                onClick={() => setPeriod("this")}
              >
                This month
              </Button>
              <Button
                size="xs"
                variant={period === "last" ? "outline" : "ghost"}
                className={period === "last" ? "shadow-xs" : ""}
                onClick={() => setPeriod("last")}
              >
                Last month
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No expenses logged{" "}
              {period === "this" ? "this month" : "last month"}.
            </p>
          ) : (
            <ChartContainer config={categoryConfig} className="h-64 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
                <Pie
                  data={categories}
                  dataKey="total"
                  nameKey="category"
                  innerRadius={50}
                  strokeWidth={2}
                >
                  {categories.map((c, i) => (
                    <Cell
                      key={c.category}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <ChartLegend
                  content={<ChartLegendContent nameKey="category" />}
                  className="flex-wrap"
                />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>Your latest 10 entries</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">{t.date}</TableCell>
                    <TableCell className="max-w-56 truncate">
                      {t.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t.category ?? "Other"}</Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        t.transaction_type === "income"
                          ? "text-green-600 dark:text-green-400"
                          : ""
                      }`}
                    >
                      {t.transaction_type === "income" ? "+" : "−"}
                      {usd.format(Number(t.amount))}
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
