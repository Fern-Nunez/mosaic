"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
} from "recharts"
import {
  Briefcase,
  CalendarClock,
  Car,
  CircleDollarSign,
  Gift,
  House,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Stethoscope,
  Tv,
  User,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react"

import type {
  AccountActivity,
  CategorySpend,
  MonthlyMoney,
} from "@/lib/stats"
import { resolveMoneyTab } from "@/components/dashboard/views"
import {
  AddAccountDialog,
  AddSubscriptionDialog,
  AddTransactionDialog,
  SubscriptionRowMenu,
} from "@/components/dashboard/money-forms"
import type {
  AccountRow,
  BillingCycle,
  SubscriptionRow,
  TransactionRow,
} from "@/lib/types"
import { cn } from "@/lib/utils"
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
import { ScrollArea } from "@/components/ui/scroll-area"

const monthlyConfig = {
  // Pastels to match the badges: soft green in, soft rose out.
  income: { label: "Income", color: "#86efac" },
  expenses: { label: "Expenses", color: "#fda4af" },
} satisfies ChartConfig

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

// Hex versions of the CATEGORY_STYLES tints (Tailwind 300-level pastels),
// so the pie slice for "Food" matches its badge.
const CATEGORY_COLORS: Record<string, string> = {
  Food: "#fcd34d",
  Groceries: "#bef264",
  Transportation: "#5eead4",
  Bills: "#cbd5e1",
  Utilities: "#67e8f9",
  Housing: "#fdba74",
  Streaming: "#c4b5fd",
  Entertainment: "#f0abfc",
  Shopping: "#f9a8d4",
  Medical: "#fca5a5",
  Personal: "#7dd3fc",
  Business: "#a5b4fc",
  Gifts: "#fda4af",
  Travel: "#6ee7b7",
  Income: "#86efac",
  Other: "#d4d4d8",
}

function categoryColor(name: string): string {
  return CATEGORY_COLORS[name] ?? CATEGORY_COLORS.Other
}

// An icon per category, for the little tile at the start of each
// transaction row (the shadcn "Recent transactions" look).
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Food: Utensils,
  Groceries: ShoppingCart,
  Transportation: Car,
  Bills: Receipt,
  Utilities: Zap,
  Housing: House,
  Streaming: Tv,
  Entertainment: Tv,
  Shopping: ShoppingBag,
  Medical: Stethoscope,
  Personal: User,
  Business: Briefcase,
  Gifts: Gift,
  Travel: Plane,
  Income: Wallet,
  Other: CircleDollarSign,
}

function categoryIcon(name: string | null): LucideIcon {
  return CATEGORY_ICONS[name ?? "Other"] ?? CircleDollarSign
}

// Tinted background + text colors keyed to categories, so each shows
// the same accent everywhere it appears (badges, filters, etc.).
const ACCOUNT_TYPE_STYLES: Record<string, string> = {
  credit_card: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/20",
  checking: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/20",
  savings: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20",
  debit: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/20",
  cash: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/20",
  investment: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/20",
}

const DEFAULT_STYLE = "bg-muted text-muted-foreground border-transparent"

function accountTypeStyle(value: string): string {
  return ACCOUNT_TYPE_STYLES[value] ?? DEFAULT_STYLE
}

// Prettify snake_case enum values coming from the database.
function humanize(value: string | null): string {
  if (!value) return "—"
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

const CYCLE_SHORT: Record<BillingCycle, string> = {
  weekly: "wk",
  monthly: "mo",
  quarterly: "qtr",
  yearly: "yr",
}

// Days between today and a YYYY-MM-DD date, negative if in the past.
function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  const target = new Date(y, m - 1, d).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today.getTime()) / 86_400_000)
}

/**
 * Card payments recur monthly, but payment_due_date is only ever the date
 * that was entered. Treat its day of the month as the due day and return the
 * next one from today, so an old "Aug 15" reads as the upcoming "Sep 15".
 * Short months clamp: a due day of 31 lands on Sep 30.
 */
function nextMonthlyDue(iso: string): string {
  const day = Number(iso.split("-")[2])
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let offset = 0; offset < 2; offset++) {
    const y = today.getFullYear()
    const m = today.getMonth() + offset
    const last = new Date(y, m + 1, 0).getDate()
    const candidate = new Date(y, m, Math.min(day, last))
    if (candidate >= today) {
      return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`
    }
  }
  return iso
}

// How close a due date has to be before it turns red.
const DUE_SOON_DAYS = 3

// "Due Sep 14", red once it's within DUE_SOON_DAYS (or already passed).
function relativeDueLabel(iso: string): { text: string; tone: string } {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
  return {
    text: `Due ${date}`,
    tone:
      daysUntil(iso) <= DUE_SOON_DAYS
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground",
  }
}

// "Today" / "Yesterday" / "Oct 12" for a transaction's date column.
function txnDateLabel(iso: string): string {
  const days = daysUntil(iso)
  if (days === 0) return "Today"
  if (days === -1) return "Yesterday"
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function MoneySection({
  monthly,
  categoriesThisMonth,
  categoriesLastMonth,
  accounts,
  accountsThisMonth,
  accountsLastMonth,
  subscriptions,
  subsMonthly,
  recent,
}: {
  monthly: MonthlyMoney[]
  categoriesThisMonth: CategorySpend[]
  categoriesLastMonth: CategorySpend[]
  accounts: AccountRow[]
  accountsThisMonth: AccountActivity[]
  accountsLastMonth: AccountActivity[]
  subscriptions: SubscriptionRow[]
  subsMonthly: number
  recent: TransactionRow[]
}) {
  const [period, setPeriod] = useState<"this" | "last">("this")
  const tab = resolveMoneyTab(useSearchParams().get("tab"))
  const categories =
    period === "this" ? categoriesThisMonth : categoriesLastMonth
  const accountRows = period === "this" ? accountsThisMonth : accountsLastMonth
  const periodLabel = period === "this" ? "this month" : "last month"
  const activeSubs = subscriptions.filter((s) => s.is_active)

  const categoryConfig = Object.fromEntries(
    categories.map((c) => [
      c.category,
      { label: c.category, color: categoryColor(c.category) },
    ])
  ) satisfies ChartConfig

  const periodToggle = (
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
  )

  // Money is split into sub-pages from the sidebar; the bare Money view is
  // the overview of income vs. expenses and where the spending went.
  if (tab === "accounts") {
    return (
      <div className="grid gap-4">
        <Card className="flex min-h-0 flex-col">
          <CardHeader>
            <CardTitle>Cards &amp; accounts</CardTitle>
            <CardDescription>
              Balances, credit usage, and activity ({periodLabel})
            </CardDescription>
            <CardAction>
              <div className="flex items-center gap-2">
                {periodToggle}
                <AddAccountDialog />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {accountRows.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">
                No accounts yet — add one to the accounts table.
              </p>
            ) : (
              <ScrollArea className="h-full">
               <ul className="space-y-4 px-6">
                {accountRows.map((a) => {
                  const isCredit = a.account_type === "credit_card"
                  const usage =
                    isCredit && a.credit_limit && a.credit_limit > 0
                      ? Math.min(100, (Number(a.credit_used) / a.credit_limit) * 100)
                      : null
                  const due = a.payment_due_date
                    ? relativeDueLabel(nextMonthlyDue(a.payment_due_date))
                    : null
                  return (
                    <li key={a.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {a.name}
                          </span>
                          {a.last_four && (
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              ••{a.last_four}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={`shrink-0 ${accountTypeStyle(a.account_type)}`}
                          >
                            {humanize(a.account_type)}
                          </Badge>
                        </div>
                        <div className="shrink-0 text-right text-sm tabular-nums">
                          <span className="text-green-600 dark:text-green-400">
                            +{usd.format(a.moneyIn)}
                          </span>
                          <span className="text-muted-foreground"> · </span>
                          <span>−{usd.format(a.moneyOut)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {a.institution && <span>{a.institution}</span>}
                        {isCredit && a.credit_used > 0 && (
                          <span>
                            Balance:{" "}
                            <span className="tabular-nums text-foreground">
                              {usd.format(Number(a.credit_used))}
                            </span>
                          </span>
                        )}
                        {due && (
                          <span className={`flex items-center gap-1 ${due.tone}`}>
                            <CalendarClock className="size-3" />
                            {due.text}
                          </span>
                        )}
                      </div>
                      {usage !== null && (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${
                                usage >= 90
                                  ? "bg-red-500"
                                  : usage >= 50
                                    ? "bg-amber-500"
                                    : "bg-primary"
                              }`}
                              style={{ width: `${usage}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {Math.round(usage)}% of{" "}
                            {usd.format(a.credit_limit ?? 0)}
                          </span>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (tab === "subscriptions") {
    return (
      <div className="grid gap-4">
        <Card className="flex min-h-0 flex-col">
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>
              {activeSubs.length === 0
                ? "No active subscriptions yet."
                : `${activeSubs.length} active · ${usd.format(subsMonthly)}/mo effective`}
            </CardDescription>
            <CardAction>
              <AddSubscriptionDialog accounts={accounts} />
            </CardAction>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {subscriptions.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">
                Add subscriptions to the subscriptions table to track them here.
              </p>
            ) : (
              <ScrollArea className="h-full">
                <ul className="space-y-2 px-6">
                  {subscriptions.map((s) => {
                    const due = s.due_date ? relativeDueLabel(s.due_date) : null
                    return (
                      <li
                        key={s.id}
                        className={cn(
                          "flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5",
                          !s.is_active && "opacity-60"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {s.name}
                            </span>
                            {!s.is_active && (
                              <Badge variant="outline">Canceled</Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.category ?? humanize(s.billing_cycle)}
                            {due && (
                              <>
                                {" · "}
                                <span className={due.tone}>{due.text}</span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {usd.format(Number(s.amount))}
                            <span className="text-xs font-normal text-muted-foreground">
                              /{CYCLE_SHORT[s.billing_cycle]}
                            </span>
                          </p>
                        </div>
                        <SubscriptionRowMenu
                          subscription={s}
                          accounts={accounts}
                        />
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (tab === "transactions") {
    return (
      <div className="grid gap-4">
        <Card className="flex min-h-0 flex-col">
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
            <CardDescription>Your latest account activity</CardDescription>
            <CardAction>
              <AddTransactionDialog accounts={accounts} />
            </CardAction>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {recent.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">
                No transactions yet.
              </p>
            ) : (
              <ScrollArea className="h-full">
                <ul className="divide-y">
                  {recent.map((t) => {
                    const Icon = categoryIcon(t.category)
                    const income = t.transaction_type === "income"
                    const color = categoryColor(t.category ?? "Other")
                    return (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 px-6 py-2.5"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {t.description ?? t.category ?? "Transaction"}
                          </p>
                          <p
                            className="truncate text-xs font-medium"
                            style={{ color }}
                          >
                            {t.category ?? "Other"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {txnDateLabel(t.date)}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            income
                              ? "text-green-600 dark:text-green-400"
                              : "text-foreground"
                          )}
                        >
                          {income ? "+" : "−"}
                          {usd.format(Number(t.amount))}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-11.5rem)] flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Income vs. expenses</CardTitle>
          <CardDescription>Last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={monthlyConfig} className="h-64 w-full">
            <BarChart accessibilityLayer data={monthly}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="income" fill="var(--color-income)" radius={4} />
              <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Fills whatever height the income chart leaves. */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Spending by category</CardTitle>
          <CardDescription>
            {period === "this" ? "This month" : "Last month"}
          </CardDescription>
          <CardAction>
            {periodToggle}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          {categories.length === 0 ? (
            <p className="flex min-h-64 flex-1 items-center justify-center text-sm text-muted-foreground">
              No expenses logged{" "}
              {period === "this" ? "this month" : "last month"}.
            </p>
          ) : (
            // The chart sizes itself from its parent, and a flex-stretched box
            // has no definite height to measure — so fill it absolutely.
            <div className="relative min-h-64 flex-1">
              <ChartContainer
                config={categoryConfig}
                className="absolute inset-0 aspect-auto"
              >
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        nameKey="category"
                        formatter={(value, name) => {
                          const total = categories.reduce(
                            (sum, c) => sum + c.total,
                            0
                          )
                          const num = Number(value)
                          const pct = total > 0 ? (num / total) * 100 : 0
                          return [
                            `${usd.format(num)} · ${pct.toFixed(0)}%`,
                            name,
                          ]
                        }}
                      />
                    }
                  />
                  <Pie
                    data={categories}
                    dataKey="total"
                    nameKey="category"
                    // Relative, so the ring keeps its shape as the chart grows.
                    innerRadius="50%"
                    strokeWidth={2}
                    labelLine={false}
                    label={({ percent }) =>
                      typeof percent === "number" && percent > 0.04
                        ? `${(percent * 100).toFixed(0)}%`
                        : ""
                    }
                  >
                    {categories.map((c) => (
                      <Cell key={c.category} fill={categoryColor(c.category)} />
                    ))}
                  </Pie>
                  <ChartLegend
                    content={<ChartLegendContent nameKey="category" />}
                    className="flex-wrap"
                  />
                </PieChart>
              </ChartContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
