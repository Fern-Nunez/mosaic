"use client"

import Link from "next/link"
import { TrendingDown, TrendingUp } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  LabelList,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts"

import { StartTick } from "@/components/app/chart-ticks"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

/** White card with the shadcn chart-card layout: title, subtitle, chart, footer. */
function ChartCard({
  href,
  title,
  subtitle,
  footer,
  footerNote,
  trend,
  children,
}: {
  href: string
  title: string
  subtitle: string
  footer?: string
  footerNote?: string
  trend?: "up" | "down"
  children: React.ReactNode
}) {
  const TrendIcon = trend === "down" ? TrendingDown : TrendingUp
  return (
    <Link href={href} className="flex flex-col gap-4 rounded-2xl bg-white dark:bg-neutral-900 p-5 active:bg-neutral-50 dark:active:bg-neutral-800">
      <div>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
      </div>
      {children}
      {(footer || footerNote) && (
        <div className="flex flex-col gap-1 text-sm">
          {footer && (
            <span className="flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100">
              {footer}
              {trend && <TrendIcon className="size-4" />}
            </span>
          )}
          {footerNote && <span className="text-neutral-500 dark:text-neutral-400">{footerNote}</span>}
        </div>
      )}
    </Link>
  )
}

/* ------------------------------------------------- Calories: radial text */

const caloriesConfig = {
  calories: { label: "Calories", color: "#C9A24A" },
} satisfies ChartConfig

export function CaloriesRadial({
  href,
  calories,
  goal,
  protein,
  proteinGoal,
}: {
  href: string
  calories: number
  goal: number
  protein: number
  proteinGoal: number
}) {
  const safeGoal = Math.max(goal, 1)
  // The ring fills to the goal and stops; the number in the middle is real.
  const data = [{ name: "calories", value: Math.min(calories, safeGoal), fill: "var(--color-calories)" }]
  const left = goal - calories

  return (
    <ChartCard
      href={href}
      title="Calories"
      subtitle="Today"
      footer={left >= 0 ? `${left.toLocaleString()} left of ${goal.toLocaleString()}` : `${Math.abs(left).toLocaleString()} over your ${goal.toLocaleString()} goal`}
      footerNote={`${protein}g of ${proteinGoal}g protein`}
    >
      <ChartContainer config={caloriesConfig} className="mx-auto aspect-square h-[220px]">
        <RadialBarChart data={data} startAngle={90} endAngle={-270} innerRadius={80} outerRadius={104}>
          <PolarAngleAxis type="number" domain={[0, safeGoal]} tick={false} axisLine={false} />
          <RadialBar dataKey="value" background cornerRadius={12} />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-neutral-900 dark:fill-neutral-100 text-4xl font-bold">
                        {calories.toLocaleString()}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 26} className="fill-neutral-500 dark:fill-neutral-400 text-sm">
                        Calories
                      </tspan>
                    </text>
                  )
                }
              }}
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>
    </ChartCard>
  )
}

/* ---------------------------------------------- Money: horizontal bars */

const moneyConfig = {
  income: { label: "Income", color: "#4E8A6B" },
  expense: { label: "Expense", color: "#C8735F" },
  saved: { label: "Saved", color: "#6A7FB8" },
} satisfies ChartConfig

export function MoneyBars({
  href,
  month,
  income,
  expense,
}: {
  href: string
  month: string
  income: number
  expense: number
}) {
  const saved = income - expense
  const data = [
    { key: "income", label: "Income", value: income, fill: "var(--color-income)" },
    { key: "expense", label: "Expense", value: expense, fill: "var(--color-expense)" },
    { key: "saved", label: "Saved", value: saved, fill: "var(--color-saved)" },
  ]
  const rate = income > 0 ? Math.round((saved / income) * 100) : null

  return (
    <ChartCard
      href={href}
      title="Money"
      subtitle={`${month} so far`}
      footer={
        income === 0 && expense === 0
          ? "Nothing logged this month"
          : saved >= 0
            ? rate !== null
              ? `Saving ${rate}% of income`
              : `${usd.format(saved)} saved`
            : `${usd.format(Math.abs(saved))} more out than in`
      }
      trend={income === 0 && expense === 0 ? undefined : saved >= 0 ? "up" : "down"}
      footerNote="Income, spending, and what's left"
    >
      <ChartContainer config={moneyConfig} className="aspect-auto h-[150px] w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 64 }}>
          <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={64} tick={<StartTick />} />
          <XAxis type="number" dataKey="value" hide domain={[Math.min(0, saved), "dataMax"]} />
          <Bar dataKey="value" radius={6} isAnimationActive={false}>
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              className="fill-neutral-900 dark:fill-neutral-100"
              fontSize={12}
              formatter={(value) => usd.format(Number(value))}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

/* -------------------------------------------- Weight: line with labels */

const weightConfig = {
  weight: { label: "Weight", color: "#5A9E9A" },
} satisfies ChartConfig

export type WeightPoint = { date: string; weight: number }

function shortDate(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function WeightLine({
  href,
  points,
  unit,
}: {
  href: string
  points: WeightPoint[]
  unit: string
}) {
  const data = points.map((p) => ({ ...p, label: shortDate(p.date) }))
  const first = points[0]
  const last = points[points.length - 1]
  const change = first && last ? Math.round((last.weight - first.weight) * 10) / 10 : 0

  if (points.length < 2) {
    return (
      <ChartCard
        href={href}
        title="Weight"
        subtitle={last ? `${last.weight} ${unit} on ${shortDate(last.date)}` : "No weigh-ins yet"}
        footerNote="Log a couple of weigh-ins to see a trend."
      >
        {null}
      </ChartCard>
    )
  }

  return (
    <ChartCard
      href={href}
      title="Weight"
      subtitle={`Last ${points.length} weigh-ins`}
      footer={
        change === 0
          ? `Holding at ${last.weight} ${unit}`
          : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} ${unit} since ${shortDate(first.date)}`
      }
      trend={change === 0 ? undefined : change > 0 ? "up" : "down"}
      footerNote={`Latest: ${last.weight} ${unit} on ${shortDate(last.date)}`}
    >
      <ChartContainer config={weightConfig} className="aspect-auto h-[180px] w-full">
        <LineChart data={data} margin={{ top: 24, left: 0, right: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} padding={{ left: 24, right: 24 }} />
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <Line
            dataKey="weight"
            type="natural"
            stroke="var(--color-weight)"
            strokeWidth={2}
            dot={{ fill: "var(--color-weight)" }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          >
            <LabelList position="top" offset={12} className="fill-neutral-900 dark:fill-neutral-100" fontSize={12} />
          </Line>
        </LineChart>
      </ChartContainer>
    </ChartCard>
  )
}
