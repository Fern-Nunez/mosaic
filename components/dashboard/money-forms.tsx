"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  MoreHorizontal,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/components/dashboard/workspace-context"
import type { AccountRow, BillingCycle, SubscriptionRow } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const ACCOUNT_TYPES = [
  { value: "credit_card", label: "Credit Card" },
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "debit", label: "Debit" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
] as const

const BILLING_CYCLES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const

// Shared category options for transactions + subscriptions. Ordered
// roughly by everyday frequency.
const CATEGORIES = [
  "Food",
  "Groceries",
  "Transportation",
  "Bills",
  "Utilities",
  "Housing",
  "Streaming",
  "Entertainment",
  "Shopping",
  "Medical",
  "Personal",
  "Business",
  "Gifts",
  "Travel",
  "Income",
  "Other",
] as const

// Snake_case matches what the subscription auto-advancer inserts
// (which copies the account_type), so grouping by payment method
// stays consistent across manual and auto-generated rows.
const PAYMENT_METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "cash_app", label: "Cash App" },
  { value: "apple_pay", label: "Apple Pay" },
  { value: "google_pay", label: "Google Pay" },
  { value: "ach", label: "ACH / Bank Transfer" },
  { value: "check", label: "Check" },
] as const

const NONE = "__none__"

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function AddButton({ label }: { label: string }) {
  return (
    <DialogTrigger
      render={
        <Button size="xs" variant="outline">
          <Plus className="size-3.5" />
          {label}
        </Button>
      }
    />
  )
}

// Base UI's Select can emit `null` when cleared. Our selects always
// have a default value, so we ignore nulls and keep string setters.
function pick<T extends string>(
  setter: React.Dispatch<React.SetStateAction<T>>
) {
  return (value: string | null) => {
    if (value !== null) setter(value as T)
  }
}

function DialogShell({
  title,
  description,
  onOpenChange,
  onSubmit,
  submitting,
  error,
  disabled,
  children,
}: {
  title: string
  description: string
  onOpenChange: (open: boolean) => void
  onSubmit: (event: React.FormEvent) => void
  submitting: boolean
  error: string | null
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        {children}
        {error && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || disabled}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

// ---------- Account ----------

export function AddAccountDialog() {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const { active } = useWorkspace()
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState("credit_card")
  const [institution, setInstitution] = React.useState("")
  const [lastFour, setLastFour] = React.useState("")
  const [creditLimit, setCreditLimit] = React.useState("")
  const [creditUsed, setCreditUsed] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")

  function reset() {
    setName("")
    setType("credit_card")
    setInstitution("")
    setLastFour("")
    setCreditLimit("")
    setCreditUsed("")
    setDueDate("")
    setError(null)
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from("accounts").insert({
      workspace: active.id,
      name: name.trim(),
      account_type: type,
      institution: institution.trim() || null,
      last_four: lastFour.trim() || null,
      credit_limit: creditLimit ? Number(creditLimit) : null,
      credit_used: creditUsed ? Number(creditUsed) : 0,
      payment_due_date: dueDate || null,
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    reset()
    setOpen(false)
    router.refresh()
  }

  const isCredit = type === "credit_card"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <AddButton label="Add" />
      <DialogShell
        title="Add account"
        description="A card, bank account, or cash pile."
        onOpenChange={setOpen}
        onSubmit={onSubmit}
        submitting={submitting}
        error={error}
        disabled={!name.trim()}
      >
        <Field label="Name" hint="e.g. Chase Freedom Unlimited">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onValueChange={pick(setType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Institution">
            <Input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="Chase"
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Last 4">
            <Input
              value={lastFour}
              onChange={(e) => setLastFour(e.target.value)}
              maxLength={4}
              inputMode="numeric"
              placeholder="9716"
            />
          </Field>
          {isCredit && (
            <>
              <Field label="Limit">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="7000"
                />
              </Field>
              <Field label="Balance">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={creditUsed}
                  onChange={(e) => setCreditUsed(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </>
          )}
        </div>
        {isCredit && (
          <Field label="Payment due date" hint="Next due date">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
        )}
      </DialogShell>
    </Dialog>
  )
}

// ---------- Transaction ----------

export function AddTransactionDialog({ accounts }: { accounts: AccountRow[] }) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const { active } = useWorkspace()
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [date, setDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [amount, setAmount] = React.useState("")
  const [type, setType] = React.useState<"income" | "expense">("expense")
  const [category, setCategory] = React.useState<string>(NONE)
  const [paymentMethod, setPaymentMethod] = React.useState<string>(NONE)
  const [accountId, setAccountId] = React.useState<string>(NONE)
  const [description, setDescription] = React.useState("")

  function reset() {
    setDate(new Date().toISOString().slice(0, 10))
    setAmount("")
    setType("expense")
    setCategory(NONE)
    setPaymentMethod(NONE)
    setAccountId(NONE)
    setDescription("")
    setError(null)
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from("transactions").insert({
      workspace: active.id,
      date,
      amount: Number(amount),
      transaction_type: type,
      category: category === NONE ? null : category,
      payment_method: paymentMethod === NONE ? null : paymentMethod,
      account_id: accountId === NONE ? null : accountId,
      description: description.trim() || null,
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <AddButton label="Add" />
      <DialogShell
        title="Add transaction"
        description="Log an income or expense."
        onOpenChange={setOpen}
        onSubmit={onSubmit}
        submitting={submitting}
        error={error}
        disabled={!amount || Number(amount) <= 0}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Amount">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              required
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onValueChange={pick(setType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={category} onValueChange={pick(setCategory)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="(none)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>(none)</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account">
            <Select value={accountId} onValueChange={pick(setAccountId)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="(none)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>(none)</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.last_four ? ` ••${a.last_four}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Payment method">
            <Select
              value={paymentMethod}
              onValueChange={pick(setPaymentMethod)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="(none)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>(none)</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this for?"
            className="min-h-20"
          />
        </Field>
      </DialogShell>
    </Dialog>
  )
}

// ---------- Subscription ----------

// Single dialog for both add and edit. Pass `existing` and controlled
// open/onOpenChange to edit; leave them off for add (renders its own
// trigger button and manages open state).
export function SubscriptionDialog({
  existing,
  accounts,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  existing?: SubscriptionRow
  accounts: AccountRow[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const { active } = useWorkspace()
  const isEdit = existing !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = openProp ?? internalOpen
  const setOpen = onOpenChangeProp ?? setInternalOpen
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [name, setName] = React.useState(existing?.name ?? "")
  const [amount, setAmount] = React.useState(
    existing ? String(existing.amount) : ""
  )
  const [cycle, setCycle] = React.useState<BillingCycle>(
    existing?.billing_cycle ?? "monthly"
  )
  const [category, setCategory] = React.useState<string>(
    existing?.category ?? NONE
  )
  const [accountId, setAccountId] = React.useState<string>(
    existing?.account_id ?? NONE
  )
  const [dueDate, setDueDate] = React.useState(existing?.due_date ?? "")

  function reset() {
    setName("")
    setAmount("")
    setCycle("monthly")
    setCategory(NONE)
    setAccountId(NONE)
    setDueDate("")
    setError(null)
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const payload = {
      name: name.trim(),
      amount: Number(amount),
      billing_cycle: cycle,
      category: category === NONE ? null : category,
      account_id: accountId === NONE ? null : accountId,
      due_date: dueDate || null,
    }
    const { error: err } = isEdit
      ? await supabase
          .from("subscriptions")
          .update(payload)
          .eq("id", existing!.id)
      : await supabase
          .from("subscriptions")
          .insert({ ...payload, workspace: active.id })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    if (!isEdit) reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && <AddButton label="Add" />}
      <DialogShell
        title={isEdit ? "Edit subscription" : "Add subscription"}
        description={
          isEdit
            ? "Update the details or reschedule the next charge."
            : "A recurring bill you want tracked."
        }
        onOpenChange={setOpen}
        onSubmit={onSubmit}
        submitting={submitting}
        error={error}
        disabled={!name.trim() || !amount || Number(amount) <= 0}
      >
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Netflix"
            autoFocus
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="15.99"
              required
            />
          </Field>
          <Field label="Billing cycle">
            <Select value={cycle} onValueChange={pick(setCycle)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_CYCLES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Card / account">
            <Select value={accountId} onValueChange={pick(setAccountId)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="(none)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>(none)</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.last_four ? ` ••${a.last_four}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={category} onValueChange={pick(setCategory)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="(none)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>(none)</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Next due date">
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
      </DialogShell>
    </Dialog>
  )
}

// Legacy export name kept for cleaner naming in call sites.
export const AddSubscriptionDialog = SubscriptionDialog

export function SubscriptionRowMenu({
  subscription,
  accounts,
}: {
  subscription: SubscriptionRow
  accounts: AccountRow[]
}) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const [editOpen, setEditOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  async function onDelete() {
    if (
      !window.confirm(
        `Delete "${subscription.name}"? Past transactions from this subscription stay in your history.`
      )
    ) {
      return
    }
    setBusy(true)
    const { error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("id", subscription.id)
    setBusy(false)
    if (error) {
      window.alert(`Couldn't delete: ${error.message}`)
      return
    }
    router.refresh()
  }

  async function onToggleActive() {
    setBusy(true)
    const { error } = await supabase
      .from("subscriptions")
      .update({ is_active: !subscription.is_active })
      .eq("id", subscription.id)
    setBusy(false)
    if (error) {
      window.alert(`Couldn't update: ${error.message}`)
      return
    }
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label={`Actions for ${subscription.name}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleActive}>
            {subscription.is_active ? (
              <>
                <PauseCircle className="size-4" />
                Mark canceled
              </>
            ) : (
              <>
                <PlayCircle className="size-4" />
                Reactivate
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SubscriptionDialog
        existing={subscription}
        accounts={accounts}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  )
}
