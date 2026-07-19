"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Loader2, Minus, Plus, Scale, TrendingDown, TrendingUp } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useWorkspace } from "@/components/dashboard/workspace-context"
import { todayKey, weightSeries } from "@/lib/stats"
import type { WeightRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const weightConfig = {
  // Emerald to match the site accent, the "Log weigh-in" button, and the
  // weight chip.
  weight: { label: "Weight", color: "#10b981" },
} satisfies ChartConfig

// The optional body-measurement fields, each with a color identity so the
// "Latest measurements" grid reads as a set of colored chips rather than a
// flat table. Weight itself gets the violet accent (matching the overview).
type MeasureKey = "weight" | "body_fat" | "waist" | "chest" | "arms" | "legs"

const MEASURES: {
  key: MeasureKey
  label: string
  suffix: (unit: string) => string
  chip: string
}[] = [
  {
    key: "weight",
    label: "Weight",
    suffix: (u) => ` ${u}`.trimEnd(),
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "body_fat",
    label: "Body fat",
    suffix: () => "%",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    key: "waist",
    label: "Waist",
    suffix: () => '"',
    chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  {
    key: "chest",
    label: "Chest",
    suffix: () => '"',
    chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    key: "arms",
    label: "Arms",
    suffix: () => '"',
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
  {
    key: "legs",
    label: "Legs",
    suffix: () => '"',
    chip: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  },
]

function Measurement({
  label,
  value,
  chip,
}: {
  label: string
  value: string
  chip: string
}) {
  return (
    <div className={cn("rounded-lg p-3", chip)}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

// "Sat, Jul 19" for a YYYY-MM-DD key, parsed in local time.
function entryDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

type HistoryEntry = { row: WeightRow; delta: number | null }

// Newest-first list of weigh-ins, each with the change in weight from the
// previous chronological entry (null for the very first weigh-in).
function buildHistory(rows: WeightRow[]): HistoryEntry[] {
  const asc = rows.filter((r) => r.weight != null)
  return asc
    .map((row, i) => {
      const prev = i > 0 ? asc[i - 1] : null
      const delta =
        prev && prev.weight != null
          ? Math.round((Number(row.weight) - Number(prev.weight)) * 10) / 10
          : null
      return { row, delta }
    })
    .reverse()
}

export function WeightSection({
  rows: initialRows,
  userId,
}: {
  rows: WeightRow[]
  userId: string
}) {
  const [rows, setRows] = React.useState<WeightRow[]>(initialRows)

  // Rows arrive oldest-first from the server; keep them that way on insert so
  // the chart and "latest" stay correct without a full reload.
  const series = React.useMemo(() => weightSeries(rows), [rows])
  const history = React.useMemo(() => buildHistory(rows), [rows])
  const latest = rows.length > 0 ? rows[rows.length - 1] : null
  const unit = latest?.unit && latest.unit !== "unknown" ? latest.unit : ""

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Weight</h2>
          <p className="text-sm text-muted-foreground">
            Track your weigh-ins and measurements.
          </p>
        </div>
        <LogWeightDialog
          userId={userId}
          defaultUnit={unit || "lbs"}
          onLogged={(row) =>
            setRows((prev) =>
              [...prev, row].sort((a, b) => a.date.localeCompare(b.date))
            )
          }
        />
      </div>

      {/* Full-width trend chart */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Body weight</CardTitle>
          <CardDescription>All logged weigh-ins</CardDescription>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              No weigh-ins logged yet.
            </p>
          ) : (
            <ChartContainer config={weightConfig} className="h-72 w-full">
              <AreaChart accessibilityLayer data={series}>
                <defs>
                  <linearGradient id="fillWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-weight)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-weight)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={45}
                  domain={["auto", "auto"]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="weight"
                  type="monotone"
                  stroke="var(--color-weight)"
                  strokeWidth={2}
                  fill="url(#fillWeight)"
                  dot={{ r: 3, fill: "var(--color-weight)" }}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Full-width latest measurements, chips left-to-right */}
      <Card>
        <CardHeader>
          <CardTitle>Latest measurements</CardTitle>
          <CardDescription>
            {latest ? `Logged ${entryDate(latest.date)}` : "Nothing logged yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {latest ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {MEASURES.map((m) => {
                const value = latest[m.key]
                if (value == null) return null
                return (
                  <Measurement
                    key={m.key}
                    label={m.label}
                    chip={m.chip}
                    value={`${Number(value)}${m.suffix(unit)}`}
                  />
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Log a weigh-in to see it here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Full-width history — each weigh-in as a card, newest on the left */}
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            {history.length === 0
              ? "Nothing logged yet"
              : `${history.length} ${history.length === 1 ? "weigh-in" : "weigh-ins"}, newest first`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your weigh-ins will appear here.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {history.map(({ row, delta }) => (
                <HistoryCard key={row.id} row={row} delta={delta} unit={unit} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function HistoryCard({
  row,
  delta,
  unit,
}: {
  row: WeightRow
  delta: number | null
  unit: string
}) {
  // Down = green, up = rose (a loss-oriented default), flat/first = muted.
  const trend =
    delta == null || delta === 0
      ? {
          Icon: Minus,
          tone: "text-muted-foreground",
          text: delta === 0 ? "no change" : "first",
        }
      : delta < 0
        ? {
            Icon: TrendingDown,
            tone: "text-emerald-600 dark:text-emerald-400",
            text: `${delta} ${unit}`.trim(),
          }
        : {
            Icon: TrendingUp,
            tone: "text-rose-600 dark:text-rose-400",
            text: `+${delta} ${unit}`.trim(),
          }
  const Icon = trend.Icon

  return (
    <div className="flex w-40 shrink-0 flex-col gap-2 rounded-xl border bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {entryDate(row.date)}
      </p>
      <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
        {Number(row.weight)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          {unit}
        </span>
      </p>
      <div className={cn("flex items-center gap-1 text-xs font-medium", trend.tone)}>
        <Icon className="size-3.5" />
        {trend.text}
      </div>
      {row.body_fat != null && (
        <p className="mt-auto text-xs text-muted-foreground">
          {Number(row.body_fat)}% body fat
        </p>
      )}
    </div>
  )
}

type Draft = {
  date: string
  weight: string
  unit: "lbs" | "kg"
  body_fat: string
  waist: string
  chest: string
  arms: string
  legs: string
}

function emptyDraft(unit: "lbs" | "kg"): Draft {
  return {
    date: todayKey(),
    weight: "",
    unit,
    body_fat: "",
    waist: "",
    chest: "",
    arms: "",
    legs: "",
  }
}

// Optional numeric fields shown below the weight — each maps straight to its
// personal_weight column.
const OPTIONAL_FIELDS: { key: keyof Draft; label: string }[] = [
  { key: "body_fat", label: "Body fat (%)" },
  { key: "waist", label: 'Waist (")' },
  { key: "chest", label: 'Chest (")' },
  { key: "arms", label: 'Arms (")' },
  { key: "legs", label: 'Legs (")' },
]

function LogWeightDialog({
  userId,
  defaultUnit,
  onLogged,
}: {
  userId: string
  defaultUnit: string
  onLogged: (row: WeightRow) => void
}) {
  const supabase = React.useMemo(() => createClient(), [])
  const { active } = useWorkspace()
  const unit = defaultUnit === "kg" ? "kg" : "lbs"

  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<Draft>(() => emptyDraft(unit))
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function onOpenChange(next: boolean) {
    if (next) {
      setDraft(emptyDraft(unit))
      setError(null)
    }
    setOpen(next)
  }

  // "" -> null, otherwise a finite number. Returns undefined on a bad value.
  function toNumber(raw: string): number | null | undefined {
    if (raw.trim() === "") return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const weight = toNumber(draft.weight)
    if (weight == null) {
      setError("Enter a weight greater than 0.")
      return
    }

    const optional: Record<string, number | null> = {}
    for (const field of OPTIONAL_FIELDS) {
      const value = toNumber(draft[field.key] as string)
      if (value === undefined) {
        setError(`${field.label} must be a number greater than 0.`)
        return
      }
      optional[field.key] = value
    }

    setBusy(true)
    const { data, error: err } = await supabase
      .from("personal_weight")
      .insert({
        user_id: userId,
        workspace: active.id,
        date: draft.date,
        weight,
        unit: draft.unit,
        ...optional,
      })
      .select("id, date, weight, unit, body_fat, waist, chest, arms, legs, notes")
      .single()
    setBusy(false)

    if (err || !data) {
      setError(err?.message ?? "Couldn't save your weigh-in.")
      return
    }

    onLogged(data as WeightRow)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button className="shrink-0 bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm hover:from-emerald-600 hover:to-green-700">
            <Plus className="size-4" />
            Log weigh-in
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Scale className="size-4.5" />
            </span>
            Log a weigh-in
          </DialogTitle>
          <DialogDescription>
            Weight is required. Measurements are optional.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="weigh-date">Date</Label>
              <Input
                id="weigh-date"
                type="date"
                max={todayKey()}
                value={draft.date}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weigh-unit">Unit</Label>
              <Select
                value={draft.unit}
                onValueChange={(value) => {
                  if (value)
                    setDraft((d) => ({ ...d, unit: value as "lbs" | "kg" }))
                }}
              >
                <SelectTrigger id="weigh-unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lbs">lbs</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="weigh-weight">Weight ({draft.unit})</Label>
            <Input
              id="weigh-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              placeholder="0.0"
              autoFocus
              value={draft.weight}
              onChange={(e) =>
                setDraft((d) => ({ ...d, weight: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {OPTIONAL_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`weigh-${field.key}`}>{field.label}</Label>
                <Input
                  id={`weigh-${field.key}`}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  value={draft[field.key] as string}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [field.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save weigh-in"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
