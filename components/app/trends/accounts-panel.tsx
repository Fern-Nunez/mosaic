"use client"

import * as React from "react"
import { Nfc, Plus } from "lucide-react"

import { Panel } from "@/components/app/trends/detail-parts"
import { SubscriptionEditor, type SubscriptionTarget } from "@/components/app/trends/subscription-editor"
import { daysBetween, keyToDate } from "@/lib/app/dates"
import { usd, usdCents } from "@/lib/app/metrics"
import type { TrendData } from "@/lib/app/trend-data"
import { cn } from "@/lib/utils"

type Account = TrendData["accounts"][number]
type Subscription = TrendData["subscriptions"][number]

/** Card faces, picked by position so neighbors never match. */
const FACES = [
  ["#23272E", "#4B525E"],
  ["#1F4E3D", "#2FA36B"],
  ["#2D4A66", "#3FA2E8"],
  ["#5B3A6B", "#B068E0"],
  ["#6E3F31", "#EE6C4D"],
  ["#6B5626", "#F2B33D"],
]

const TYPE_LABEL: Record<string, string> = {
  credit_card: "Credit",
  checking: "Checking",
  savings: "Savings",
  debit: "Debit",
  cash: "Cash",
  investment: "Investing",
}

const CYCLE_SHORT: Record<string, string> = { weekly: "wk", monthly: "mo", quarterly: "qtr", yearly: "yr" }
const PER_MONTH: Record<string, number> = { weekly: 4.345, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }

const DUE_SOON_DAYS = 3

/**
 * payment_due_date is whatever date was entered; card payments repeat
 * monthly, so use its day of the month and return the next one from today.
 * Short months clamp (a due day of 31 lands on Nov 30).
 */
function nextMonthlyDue(iso: string, today: string): string {
  const day = Number(iso.split("-")[2])
  const t = keyToDate(today)
  for (let offset = 0; offset < 2; offset++) {
    const y = t.getFullYear()
    const m = t.getMonth() + offset
    const last = new Date(y, m + 1, 0).getDate()
    const c = new Date(y, m, Math.min(day, last))
    const key = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`
    if (key >= today) return key
  }
  return iso
}

const daysUntil = (today: string, key: string) => daysBetween(today, key) - 1
const short = (key: string) => keyToDate(key).toLocaleDateString("en-US", { month: "short", day: "numeric" })
function inDays(n: number) {
  if (n < 0) return `${-n} day${n === -1 ? "" : "s"} ago`
  if (n === 0) return "today"
  if (n === 1) return "tomorrow"
  return `in ${n} days`
}

/** Swipeable cards; under the one in view, when it's due and what's billed to it. */
export function AccountsPanel({ accounts, subscriptions, today }: { accounts: Account[]; subscriptions: Subscription[]; today: string }) {
  const [active, setActive] = React.useState(0)
  const [editing, setEditing] = React.useState<SubscriptionTarget | null>(null)
  const track = React.useRef<HTMLDivElement>(null)

  const onScroll = () => {
    const el = track.current
    if (!el || !el.firstElementChild) return
    const step = (el.firstElementChild as HTMLElement).offsetWidth + 12
    setActive(Math.max(0, Math.min(accounts.length - 1, Math.round(el.scrollLeft / step))))
  }
  const goTo = (i: number) => {
    const card = track.current?.children[i] as HTMLElement | undefined
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }

  if (accounts.length === 0) {
    return (
      <Panel title="Accounts">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No cards or accounts yet. Add them from the old dashboard&apos;s Money page for now.
        </p>
      </Panel>
    )
  }

  const account = accounts[Math.min(active, accounts.length - 1)]
  const subs = subscriptions.filter((s) => s.account_id === account.id)
  const monthly = subs.reduce((t, s) => t + s.amount * (PER_MONTH[s.billing_cycle] ?? 1), 0)
  const due = account.payment_due_date ? nextMonthlyDue(account.payment_due_date, today) : null
  const dueIn = due ? daysUntil(today, due) : null
  const isCredit = account.account_type === "credit_card"
  const used = isCredit && account.credit_limit ? account.credit_used / account.credit_limit : null

  return (
    <Panel title="Accounts" subtitle={accounts.length > 1 ? `${accounts.length} accounts · swipe to switch` : undefined}>
      {/* Bleeds to the panel edges so the next card peeks in. */}
      <div
        ref={track}
        onScroll={onScroll}
        className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {accounts.map((a, i) => (
          <CardFace key={a.id} account={a} face={FACES[i % FACES.length]} only={accounts.length === 1} />
        ))}
      </div>

      {accounts.length > 1 && (
        <div className="-mt-1 flex justify-center gap-1.5">
          {accounts.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-label={`Show ${a.name}`}
              aria-current={i === active}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 cursor-pointer rounded-full transition-all",
                i === active ? "w-4 bg-neutral-800 dark:bg-neutral-200" : "w-1.5 bg-neutral-300 dark:bg-neutral-700"
              )}
            />
          ))}
        </div>
      )}

      {/* When it's due, and how much of the limit is used. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="chip rounded-xl px-3 py-2.5">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Payment due</p>
          {due && dueIn !== null ? (
            <>
              <p className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">{short(due)}</p>
              <p className={cn("text-xs", dueIn <= DUE_SOON_DAYS ? "text-[#E5534B]" : "text-neutral-500 dark:text-neutral-400")}>
                {inDays(dueIn)}
              </p>
            </>
          ) : (
            <p className="text-[15px] font-medium text-neutral-400 dark:text-neutral-500">None set</p>
          )}
        </div>
        <div className="chip rounded-xl px-3 py-2.5">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{isCredit ? "Balance" : "Subscriptions"}</p>
          {isCredit ? (
            <>
              <p className="text-[15px] font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{usdCents.format(account.credit_used)}</p>
              {used !== null ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10">
                    <span
                      className={cn("block h-full rounded-full", used <= 0.7 && "bar-fill")}
                      style={{ width: `${Math.min(used, 1) * 100}%`, backgroundColor: used > 0.7 ? "#E5534B" : undefined }}
                    />
                  </span>
                  <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">of {usd.format(account.credit_limit!)}</span>
                </div>
              ) : (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">No limit set</p>
              )}
            </>
          ) : (
            <>
              <p className="text-[15px] font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{usdCents.format(monthly)}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">a month</p>
            </>
          )}
        </div>
      </div>

      {/* Subscriptions billed to this card. */}
      <div>
        <SubscriptionEditor target={editing} accounts={accounts} today={today} onClose={() => setEditing(null)} />
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Subscriptions on this {isCredit || account.account_type === "debit" ? "card" : "account"}
          </p>
          {subs.length > 0 && <p className="shrink-0 text-sm tabular-nums text-neutral-500 dark:text-neutral-400">{usdCents.format(monthly)}/mo</p>}
        </div>
        {subs.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Nothing billed here.</p>
        ) : (
          <ul className="mt-1">
            {subs.map((s) => {
              const n = s.due_date ? daysUntil(today, s.due_date) : null
              return (
                <li key={s.id} className="border-t border-black/[0.07] dark:border-white/[0.08] first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setEditing({ mode: "edit", subscription: s })}
                    className="-mx-2 flex min-h-12 w-[calc(100%+1rem)] cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left active:bg-neutral-50 dark:active:bg-neutral-800"
                  >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-neutral-900 dark:text-neutral-100">{s.name}</p>
                    <p className={cn("text-xs", n !== null && n <= DUE_SOON_DAYS ? "text-[#E5534B]" : "text-neutral-500 dark:text-neutral-400")}>
                      {s.due_date && n !== null ? `Renews ${short(s.due_date)} · ${inDays(n)}` : "No renewal date"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-neutral-700 dark:text-neutral-300">
                    {usdCents.format(s.amount)}
                    <span className="text-neutral-400 dark:text-neutral-500">/{CYCLE_SHORT[s.billing_cycle] ?? "mo"}</span>
                  </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setEditing({ mode: "add", accountId: account.id })}
          className="chip mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm text-neutral-700 transition-transform active:scale-[0.98] dark:text-neutral-300"
        >
          <Plus className="size-4" />
          Add subscription
        </button>
      </div>
    </Panel>
  )
}

/** A bank-card-shaped face: institution and type up top, name and last four below. */
function CardFace({ account, face, only }: { account: Account; face: string[]; only: boolean }) {
  const tappable = account.account_type === "credit_card" || account.account_type === "debit"
  return (
    <div
      className={cn(
        "relative aspect-[1.586] shrink-0 snap-center overflow-hidden rounded-2xl p-4 text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.45)]",
        only ? "w-full" : "w-[84%]"
      )}
      style={{ background: `linear-gradient(135deg, ${face[0]} 0%, ${face[1]} 100%)` }}
    >
      {/* Two soft diagonal bands for a bit of sheen. */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-56 w-28 rotate-[30deg] bg-white/[0.07]" />
      <span aria-hidden className="pointer-events-none absolute right-12 -top-16 h-56 w-12 rotate-[30deg] bg-white/[0.05]" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-white/80">{account.institution || TYPE_LABEL[account.account_type] || "Account"}</p>
          <p className="shrink-0 text-xs font-semibold tracking-wider text-white/70 uppercase">{TYPE_LABEL[account.account_type] ?? ""}</p>
        </div>
        {tappable && <Nfc aria-hidden className="size-5 text-white/60" strokeWidth={1.75} />}
        <div className="flex items-end justify-between gap-2">
          <p className="min-w-0 truncate text-lg leading-tight font-semibold">{account.name}</p>
          {account.last_four && (
            <p className="shrink-0 font-mono text-sm tracking-widest text-white/85">•••• {account.last_four}</p>
          )}
        </div>
      </div>
    </div>
  )
}
