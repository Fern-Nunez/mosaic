"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Repeat2 } from "lucide-react"

import { Choice, ErrorText, Field, FieldGroup, NumberInput, SaveButton, Segmented, TextInput, toNumber } from "@/components/app/log/fields"
import { useWorkspace } from "@/components/dashboard/workspace-context"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import type { TrendData } from "@/lib/app/trend-data"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Subscription = TrendData["subscriptions"][number]
type Account = TrendData["accounts"][number]

/** What the sheet is doing: adding one to a card, or editing a saved one. */
export type SubscriptionTarget = { mode: "add"; accountId: string } | { mode: "edit"; subscription: Subscription }

const CYCLES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const
type Cycle = (typeof CYCLES)[number]["value"]

// The category each charge is logged under when it renews.
const CATEGORIES = ["Streaming", "Utilities", "Bills", "Entertainment", "Personal", "Business", "Shopping", "Medical", "Other"] as const

/** Bottom sheet to add, change or delete a subscription. */
export function SubscriptionEditor({
  target,
  accounts,
  today,
  onClose,
}: {
  target: SubscriptionTarget | null
  accounts: Account[]
  today: string
  onClose: () => void
}) {
  const sheetRef = React.useRef<HTMLDivElement>(null)
  // Keep the last one on screen while the sheet slides closed.
  const [shown, setShown] = React.useState<SubscriptionTarget | null>(target)
  if (target && target !== shown) setShown(target)

  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        initialFocus={sheetRef}
        ref={sheetRef}
        tabIndex={-1}
        className="mx-auto max-h-[92svh] max-w-[440px] gap-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-3xl border-0 bg-white px-5 pt-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <div className="mb-5 flex items-center gap-3 pr-10">
          <Repeat2 className="size-5 text-[#318E63]" />
          <SheetTitle className="text-lg font-semibold">{shown?.mode === "edit" ? "Edit subscription" : "Add subscription"}</SheetTitle>
          <SheetDescription className="sr-only">A recurring charge on one of your cards.</SheetDescription>
        </div>
        {shown && (
          <SubscriptionForm
            key={shown.mode === "edit" ? shown.subscription.id : `new-${shown.accountId}`}
            target={shown}
            accounts={accounts}
            today={today}
            onDone={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function SubscriptionForm({
  target,
  accounts,
  today,
  onDone,
}: {
  target: SubscriptionTarget
  accounts: Account[]
  today: string
  onDone: () => void
}) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const { active } = useWorkspace()
  const existing = target.mode === "edit" ? target.subscription : null

  const [name, setName] = React.useState(existing?.name ?? "")
  const [amount, setAmount] = React.useState(existing ? existing.amount.toFixed(2) : "")
  const [cycle, setCycle] = React.useState<Cycle>((existing?.billing_cycle as Cycle) ?? "monthly")
  const [accountId, setAccountId] = React.useState<string>(existing?.account_id ?? (target.mode === "add" ? target.accountId : accounts[0]?.id ?? ""))
  const [category, setCategory] = React.useState<string | null>(existing?.category ?? null)
  const [dueDate, setDueDate] = React.useState(existing?.due_date ?? "")
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function run(save: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error: err } = await save()
    setBusy(false)
    if (err) return setError(err.message)
    onDone()
    router.refresh()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = toNumber(amount)
    if (!name.trim()) return setError("Give it a name.")
    if (!value || value <= 0) return setError("Enter an amount.")
    const row = {
      name: name.trim(),
      amount: Math.round(value * 100) / 100,
      billing_cycle: cycle,
      account_id: accountId || null,
      category,
      due_date: dueDate || null,
    }
    run(() =>
      existing
        ? supabase.from("subscriptions").update(row).eq("id", existing.id)
        : supabase.from("subscriptions").insert({ ...row, workspace: active.id, is_active: true })
    )
  }

  function remove() {
    if (!existing) return
    if (!confirmDelete) return setConfirmDelete(true)
    run(() => supabase.from("subscriptions").delete().eq("id", existing.id))
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Netflix" />
      </Field>
      <Field label="Amount">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-neutral-500">$</span>
          <NumberInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-14 pl-8 text-2xl tabular-nums" />
        </div>
      </Field>
      <FieldGroup label="Billed">
        <Segmented options={CYCLES} value={cycle} onChange={setCycle} />
      </FieldGroup>
      {accounts.length > 1 && (
        <FieldGroup label="Card">
          <Choice
            options={accounts.map((a) => ({ value: a.id, label: a.last_four ? `${a.name} ••${a.last_four}` : a.name }))}
            value={accountId}
            onChange={setAccountId}
          />
        </FieldGroup>
      )}
      <FieldGroup label="Category">
        <Choice options={CATEGORIES.map((c) => ({ value: c, label: c }))} value={category} onChange={(c) => setCategory(c === category ? null : c)} />
      </FieldGroup>
      <Field label="Next charge" hint={dueDate && dueDate < today ? "In the past" : undefined}>
        <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy}>{existing ? "Save changes" : "Add subscription"}</SaveButton>
      {existing && (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className={cn(
            "h-12 cursor-pointer rounded-full border text-base font-medium transition-colors disabled:opacity-50",
            confirmDelete
              ? "border-transparent bg-red-600 text-white active:bg-red-700"
              : "chip text-red-600 dark:text-red-400"
          )}
        >
          {confirmDelete ? "Tap again to delete" : "Delete subscription"}
        </button>
      )}
    </form>
  )
}
