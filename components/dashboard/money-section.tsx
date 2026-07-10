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
import { AlertTriangle, CalendarClock } from "lucide-react"

import type {
  AccountActivity,
  CategorySpend,
  MonthlyMoney,
  PaymentMethodTotals,
} from "@/lib/stats"
import { subscriptionMonthlyCost } from "@/lib/stats"
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

// Hex versions of the CATEGORY_STYLES tints (Tailwind 500-level), so
// the pie slice for "Food" is the same amber as its badge.
const CATEGORY_COLORS: Record<string, string> = {
  Food: "#f59e0b",
  Groceries: "#84cc16",
  Transportation: "#14b8a6",
  Bills: "#64748b",
  Utilities: "#06b6d4",
  Housing: "#f97316",
  Streaming: "#8b5cf6",
  Entertainment: "#d946ef",
  Shopping: "#ec4899",
  Medical: "#ef4444",
  Personal: "#0ea5e9",
  Business: "#6366f1",
  Gifts: "#f43f5e",
  Travel: "#10b981",
  Income: "#22c55e",
  Other: "#71717a",
}

function categoryColor(name: string): string {
  return CATEGORY_COLORS[name] ?? CATEGORY_COLORS.Other
}

// Tinted background + text colors keyed to categories, so each shows
// the same accent everywhere it appears (badges, filters, etc.).
const CATEGORY_STYLES: Record<string, string> = {
  Food: "bg-amber-500/15 text-amber-700 border-amber-500/20 dark:text-amber-300",
  Groceries: "bg-lime-500/15 text-lime-700 border-lime-500/20 dark:text-lime-300",
  Transportation: "bg-teal-500/15 text-teal-700 border-teal-500/20 dark:text-teal-300",
  Bills: "bg-slate-500/15 text-slate-700 border-slate-500/20 dark:text-slate-300",
  Utilities: "bg-cyan-500/15 text-cyan-700 border-cyan-500/20 dark:text-cyan-300",
  Housing: "bg-orange-500/15 text-orange-700 border-orange-500/20 dark:text-orange-300",
  Streaming: "bg-violet-500/15 text-violet-700 border-violet-500/20 dark:text-violet-300",
  Entertainment: "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-500/20 dark:text-fuchsia-300",
  Shopping: "bg-pink-500/15 text-pink-700 border-pink-500/20 dark:text-pink-300",
  Medical: "bg-red-500/15 text-red-700 border-red-500/20 dark:text-red-300",
  Personal: "bg-sky-500/15 text-sky-700 border-sky-500/20 dark:text-sky-300",
  Business: "bg-indigo-500/15 text-indigo-700 border-indigo-500/20 dark:text-indigo-300",
  Gifts: "bg-rose-500/15 text-rose-700 border-rose-500/20 dark:text-rose-300",
  Travel: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  Income: "bg-green-500/15 text-green-700 border-green-500/20 dark:text-green-300",
  Other: "bg-zinc-500/15 text-zinc-700 border-zinc-500/20 dark:text-zinc-300",
}

const PAYMENT_METHOD_STYLES: Record<string, string> = {
  credit_card: "bg-indigo-500/15 text-indigo-700 border-indigo-500/20 dark:text-indigo-300",
  debit_card: "bg-sky-500/15 text-sky-700 border-sky-500/20 dark:text-sky-300",
  cash: "bg-green-500/15 text-green-700 border-green-500/20 dark:text-green-300",
  zelle: "bg-violet-500/15 text-violet-700 border-violet-500/20 dark:text-violet-300",
  venmo: "bg-cyan-500/15 text-cyan-700 border-cyan-500/20 dark:text-cyan-300",
  cash_app: "bg-lime-500/15 text-lime-700 border-lime-500/20 dark:text-lime-300",
  apple_pay: "bg-zinc-500/15 text-zinc-700 border-zinc-500/20 dark:text-zinc-300",
  google_pay: "bg-blue-500/15 text-blue-700 border-blue-500/20 dark:text-blue-300",
  ach: "bg-slate-500/15 text-slate-700 border-slate-500/20 dark:text-slate-300",
  check: "bg-amber-500/15 text-amber-700 border-amber-500/20 dark:text-amber-300",
}

const ACCOUNT_TYPE_STYLES: Record<string, string> = {
  credit_card: "bg-indigo-500/15 text-indigo-700 border-indigo-500/20 dark:text-indigo-300",
  checking: "bg-sky-500/15 text-sky-700 border-sky-500/20 dark:text-sky-300",
  savings: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  debit: "bg-cyan-500/15 text-cyan-700 border-cyan-500/20 dark:text-cyan-300",
  cash: "bg-green-500/15 text-green-700 border-green-500/20 dark:text-green-300",
  investment: "bg-violet-500/15 text-violet-700 border-violet-500/20 dark:text-violet-300",
}

const DEFAULT_STYLE = "bg-muted text-muted-foreground border-transparent"

function categoryStyle(name: string | null): string {
  return CATEGORY_STYLES[name ?? "Other"] ?? DEFAULT_STYLE
}

function paymentMethodStyle(value: string | null): string {
  return value ? (PAYMENT_METHOD_STYLES[value] ?? DEFAULT_STYLE) : DEFAULT_STYLE
}

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

function relativeDueLabel(iso: string): { text: string; tone: string } {
  const days = daysUntil(iso)
  if (days < 0) {
    return {
      text: `${Math.abs(days)}d overdue`,
      tone: "text-red-600 dark:text-red-400",
    }
  }
  if (days === 0) return { text: "Due today", tone: "text-amber-600 dark:text-amber-400" }
  if (days === 1) return { text: "Due tomorrow", tone: "text-amber-600 dark:text-amber-400" }
  if (days <= 7) return { text: `in ${days}d`, tone: "text-amber-600 dark:text-amber-400" }
  return { text: `in ${days}d`, tone: "text-muted-foreground" }
}

export function MoneySection({
  monthly,
  categoriesThisMonth,
  categoriesLastMonth,
  methodsThisMonth,
  methodsLastMonth,
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
  methodsThisMonth: PaymentMethodTotals[]
  methodsLastMonth: PaymentMethodTotals[]
  accounts: AccountRow[]
  accountsThisMonth: AccountActivity[]
  accountsLastMonth: AccountActivity[]
  subscriptions: SubscriptionRow[]
  subsMonthly: number
  recent: TransactionRow[]
}) {
  const [period, setPeriod] = useState<"this" | "last">("this")
  const categories =
    period === "this" ? categoriesThisMonth : categoriesLastMonth
  const methods = period === "this" ? methodsThisMonth : methodsLastMonth
  const accountRows = period === "this" ? accountsThisMonth : accountsLastMonth
  const accountName = (id: string | null) =>
    id ? accounts.find((a) => a.id === id)?.name : undefined
  const periodLabel = period === "this" ? "this month" : "last month"
  const activeSubs = subscriptions.filter((s) => s.is_active)

  const categoryConfig = Object.fromEntries(
    categories.map((c) => [
      c.category,
      { label: c.category, color: categoryColor(c.category) },
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
                  innerRadius={50}
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cards &amp; accounts</CardTitle>
          <CardDescription>
            Balances, credit usage, and activity ({periodLabel})
          </CardDescription>
          <CardAction>
            <AddAccountDialog />
          </CardAction>
        </CardHeader>
        <CardContent>
          {accountRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No accounts yet — add one to the accounts table.
            </p>
          ) : (
            <ul className="space-y-4">
              {accountRows.map((a) => {
                const isCredit = a.account_type === "credit_card"
                const usage =
                  isCredit && a.credit_limit && a.credit_limit > 0
                    ? Math.min(100, (Number(a.credit_used) / a.credit_limit) * 100)
                    : null
                const due = a.payment_due_date
                  ? relativeDueLabel(a.payment_due_date)
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By payment method</CardTitle>
          <CardDescription>
            Sent and received per method ({periodLabel}) — Zelle, cards, and
            more
          </CardDescription>
        </CardHeader>
        <CardContent>
          {methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions {periodLabel}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((m) => (
                  <TableRow key={m.method}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={paymentMethodStyle(m.method)}
                      >
                        {humanize(m.method)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-green-600 dark:text-green-400">
                      {m.received > 0 ? `+${usd.format(m.received)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.sent > 0 ? `−${usd.format(m.sent)}` : "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        m.net > 0
                          ? "text-green-600 dark:text-green-400"
                          : m.net < 0
                            ? "text-red-600 dark:text-red-400"
                            : ""
                      }`}
                    >
                      {m.net > 0 ? "+" : m.net < 0 ? "−" : ""}
                      {usd.format(Math.abs(m.net))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
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
        <CardContent>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add subscriptions to the subscriptions table to track them here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Per month</TableHead>
                  <TableHead>Next charge</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((s) => {
                  const monthly = subscriptionMonthlyCost(s)
                  const due = s.due_date ? relativeDueLabel(s.due_date) : null
                  return (
                    <TableRow key={s.id} className={!s.is_active ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.name}</span>
                          {!s.is_active && (
                            <Badge variant="outline">Canceled</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.category ? (
                          <Badge
                            variant="outline"
                            className={categoryStyle(s.category)}
                          >
                            {s.category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {accountName(s.account_id) ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {usd.format(Number(s.amount))}
                        <span className="text-muted-foreground">
                          /{CYCLE_SHORT[s.billing_cycle]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {usd.format(monthly)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {due ? (
                          <span className={`flex items-center gap-1 ${due.tone}`}>
                            {daysUntil(s.due_date!) < 0 && (
                              <AlertTriangle className="size-3" />
                            )}
                            {s.due_date} · {due.text}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="p-1 text-right">
                        <SubscriptionRowMenu
                          subscription={s}
                          accounts={accounts}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>Your latest 10 entries</CardDescription>
          <CardAction>
            <AddTransactionDialog accounts={accounts} />
          </CardAction>
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
                  <TableHead>Account</TableHead>
                  <TableHead>Method</TableHead>
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
                      <Badge
                        variant="outline"
                        className={categoryStyle(t.category)}
                      >
                        {t.category ?? "Other"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {accountName(t.account_id) ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.payment_method ? (
                        <Badge
                          variant="outline"
                          className={paymentMethodStyle(t.payment_method)}
                        >
                          {humanize(t.payment_method)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
