// Colors and icons for spending categories, so each one is recognizable at
// a glance in charts and lists. Categories match the old dashboard's list.

import {
  Banknote,
  Briefcase,
  Car,
  CarTaxiFront,
  CircleDollarSign,
  Clapperboard,
  Coffee,
  CupSoda,
  Dumbbell,
  Fuel,
  Gift,
  HandCoins,
  House,
  Lightbulb,
  Music,
  Package,
  Pizza,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Tv,
  Utensils,
  type LucideIcon,
} from "lucide-react"

const CATEGORY_STYLE: Record<string, { color: string; icon: LucideIcon }> = {
  Food: { color: "#F28C38", icon: Utensils },
  Groceries: { color: "#5DB548", icon: ShoppingCart },
  Transportation: { color: "#3FA2E8", icon: Car },
  Bills: { color: "#E5534B", icon: Receipt },
  Utilities: { color: "#E9B526", icon: Lightbulb },
  Housing: { color: "#7A63E8", icon: House },
  Streaming: { color: "#C74FD6", icon: Tv },
  Entertainment: { color: "#19B5C9", icon: Clapperboard },
  Shopping: { color: "#B068E0", icon: ShoppingBag },
  Medical: { color: "#FF8FA3", icon: Stethoscope },
  Personal: { color: "#9B7BFF", icon: Sparkles },
  Business: { color: "#8E9FC7", icon: Briefcase },
  Gifts: { color: "#D9488F", icon: Gift },
  Travel: { color: "#3D8BFF", icon: Plane },
  Income: { color: "#2FA36B", icon: Banknote },
  "Paid back": { color: "#1FA99A", icon: HandCoins },
  Other: { color: "#9AA0A8", icon: CircleDollarSign },
}

// A few common merchants get a more specific icon than their category.
const KEYWORDS: [RegExp, LucideIcon][] = [
  [/coffee|starbucks|dutch bros|peet/i, Coffee],
  [/\bgas\b|shell|chevron|arco|\b76\b|mobil|exxon/i, Fuel],
  [/uber|lyft|taxi/i, CarTaxiFront],
  [/spotify|apple music/i, Music],
  [/netflix|hulu|disney|hbo|youtube/i, Tv],
  [/amazon/i, Package],
  [/rent|mortgage/i, House],
  [/gym|fitness|planet/i, Dumbbell],
  [/paycheck|salary|payroll|direct deposit/i, Banknote],
  [/pizza/i, Pizza],
  [/juice|smoothie|boba/i, CupSoda],
]

/**
 * "reimbursement" = someone paying you back (Zelle, Venmo, cash) for
 * something you already logged as an expense. It isn't income: it lowers
 * what you spent, in the category it covers.
 */
export type TxType = "income" | "expense" | "reimbursement"

export const TX_LABEL: Record<TxType, string> = { expense: "Expense", income: "Income", reimbursement: "Paid back" }

type Amounted = { amount: number | string; transaction_type: TxType; category?: string | null }

const total = (rows: Amounted[], type: TxType) =>
  rows.filter((t) => t.transaction_type === type).reduce((s, t) => s + Number(t.amount), 0)

/** Expenses minus what people paid you back. Never below zero. */
export function netSpent(rows: Amounted[]) {
  return Math.max(0, total(rows, "expense") - total(rows, "reimbursement"))
}

export function incomeTotal(rows: Amounted[]) {
  return total(rows, "income")
}

/** Spending per category, with paybacks taken off the category they cover. */
export function spentByCategory(rows: Amounted[]) {
  const by = new Map<string, number>()
  for (const t of rows) {
    if (t.transaction_type === "income") continue
    const key = t.category || "Other"
    const sign = t.transaction_type === "reimbursement" ? -1 : 1
    by.set(key, (by.get(key) ?? 0) + sign * Number(t.amount))
  }
  return new Map([...by].filter(([, v]) => v > 0))
}

/** Money coming in (shown with a + and in green). */
export const isMoneyIn = (t: { transaction_type: TxType }) => t.transaction_type !== "expense"

export function categoryColor(category: string | null | undefined): string {
  return CATEGORY_STYLE[category ?? "Other"]?.color ?? CATEGORY_STYLE.Other.color
}

export function transactionIcon(t: {
  description: string | null
  category: string | null
  transaction_type: TxType
}): LucideIcon {
  if (t.transaction_type === "reimbursement") return CATEGORY_STYLE["Paid back"].icon
  const hit = KEYWORDS.find(([re]) => re.test(t.description ?? ""))
  if (hit) return hit[1]
  if (t.transaction_type === "income") return CATEGORY_STYLE.Income.icon
  return CATEGORY_STYLE[t.category ?? "Other"]?.icon ?? CATEGORY_STYLE.Other.icon
}
