"use client"

import * as React from "react"
import {
  CalendarDays,
  Droplet,
  Drumstick,
  Flame,
  Leaf,
  Loader2,
  SlidersHorizontal,
  Wheat,
} from "lucide-react"

import {
  ESTIMATE_LEVELS,
  lastNDayKeys,
  todayKey,
  type DailyNutrition,
  type EstimateLevel,
  type NutritionGoals,
} from "@/lib/stats"
import type { NutritionRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { MealSnap } from "@/components/dashboard/meal-snap"
import { PillGauge } from "@/components/dashboard/pill-gauge"
import { Badge } from "@/components/ui/badge"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type MacroKey = keyof NutritionGoals

// One vivid color identity per macro: an icon chip, a gradient bar, and a
// matching percentage tint. This is what gives the panel its color.
const MACROS: {
  key: MacroKey
  label: string
  unit: string
  icon: React.ComponentType<{ className?: string }>
  chip: string
  bar: string
  text: string
}[] = [
  // Soft pastel identity per macro: pale chip, gentle gradient bar.
  {
    key: "calories",
    label: "Calories",
    unit: "cal",
    icon: Flame,
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    bar: "from-amber-200 to-amber-400",
    text: "text-amber-600 dark:text-amber-300",
  },
  {
    key: "protein",
    label: "Protein",
    unit: "g",
    icon: Drumstick,
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    bar: "from-rose-200 to-rose-400",
    text: "text-rose-600 dark:text-rose-300",
  },
  {
    key: "carbs",
    label: "Carbs",
    unit: "g",
    icon: Wheat,
    chip: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
    bar: "from-sky-200 to-sky-400",
    text: "text-sky-600 dark:text-sky-300",
  },
  {
    key: "fat",
    label: "Fat",
    unit: "g",
    icon: Droplet,
    chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    bar: "from-violet-200 to-violet-400",
    text: "text-violet-600 dark:text-violet-300",
  },
  {
    key: "fiber",
    label: "Fiber",
    unit: "g",
    icon: Leaf,
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    bar: "from-emerald-200 to-emerald-400",
    text: "text-emerald-600 dark:text-emerald-300",
  },
]

// Labels for the low/middle/high estimate bias, set alongside the goals.
const ESTIMATE_LABELS: Record<EstimateLevel, string> = {
  low: "Low",
  middle: "Middle",
  high: "High",
}

// Sentinel selection value for the whole-week view.
const WEEK = "week"

// "Wed, Jul 9" for a YYYY-MM-DD key, parsed in local time.
function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export function NutritionSection({
  daily,
  meals,
  goals: initialGoals,
  estimateLevel: initialEstimateLevel,
  userId,
}: {
  daily: DailyNutrition[]
  meals: NutritionRow[]
  goals: NutritionGoals
  estimateLevel: EstimateLevel
  userId: string
}) {
  // Goals load from the database (so they sync across devices) but stay
  // editable here without a full reload.
  const [goals, setGoals] = React.useState<NutritionGoals>(initialGoals)

  // The estimate bias saved with the goals, handed to every meal analysis.
  const [estimateLevel, setEstimateLevel] = React.useState<EstimateLevel>(
    initialEstimateLevel
  )

  // Selection is either a YYYY-MM-DD day key or the WEEK sentinel.
  const [selection, setSelection] = React.useState<string>(() => todayKey())

  // "This week" plus today through one week back, newest first.
  const options = React.useMemo(() => {
    const days = lastNDayKeys(8)
      .reverse()
      .map((key, index) => ({
        key,
        label:
          index === 0 ? "Today" : index === 1 ? "Yesterday" : dayLabel(key),
      }))
    return [{ key: WEEK, label: "This week" }, ...days]
  }, [])

  const isWeek = selection === WEEK

  // The day(s) feeding the bars: last 7 days for the week view, or just
  // the one selected day.
  const periodDays = React.useMemo(
    () => (isWeek ? daily.slice(-7) : daily.filter((d) => d.date === selection)),
    [isWeek, daily, selection]
  )

  // Totals eaten across the selected period, one number per macro.
  const eaten = React.useMemo(() => {
    return periodDays.reduce(
      (sum, d) => ({
        calories: sum.calories + d.calories,
        protein: sum.protein + d.protein,
        carbs: sum.carbs + d.carbs,
        fat: sum.fat + d.fat,
        fiber: sum.fiber + d.fiber,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    )
  }, [periodDays])

  const targetMultiplier = isWeek ? 7 : 1

  const weekStart = React.useMemo(() => lastNDayKeys(7)[0], [])
  const shownMeals = React.useMemo(() => {
    const list = isWeek
      ? meals.filter((m) => m.date >= weekStart)
      : meals.filter((m) => m.date === selection)
    return [...list].sort((a, b) => b.date.localeCompare(a.date))
  }, [isWeek, meals, selection, weekStart])

  const selectedLabel =
    options.find((option) => option.key === selection)?.label ??
    dayLabel(selection)

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-end gap-2">
        <GoalsDialog
          goals={goals}
          estimateLevel={estimateLevel}
          onSaved={(next, level) => {
            setGoals(next)
            setEstimateLevel(level)
          }}
        />
        <Select
          value={selection}
          onValueChange={(value) => {
            if (value) setSelection(value)
          }}
        >
          <SelectTrigger className="w-40">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MealSnap userId={userId} estimateLevel={estimateLevel} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Calories</CardTitle>
          <CardDescription>
            {isWeek ? "Last 7 days" : selectedLabel} against your{" "}
            {isWeek ? "weekly" : "daily"} goal
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 items-center">
          <PillGauge
            value={Math.round(eaten.calories)}
            max={goals.calories * targetMultiplier}
            unit="cal"
            label="Calories"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Protein</CardTitle>
          <CardDescription>
            {isWeek ? "Last 7 days" : selectedLabel} against your{" "}
            {isWeek ? "weekly" : "daily"} goal
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 items-center">
          <PillGauge
            value={Math.round(eaten.protein)}
            max={goals.protein * targetMultiplier}
            unit="g"
            label="Protein"
          />
        </CardContent>
      </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>How much you&apos;ve eaten</CardTitle>
          <CardDescription>
            {isWeek ? "Last 7 days" : selectedLabel} · each bar fills toward
            your daily goal
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {MACROS.map((macro) => {
            const Icon = macro.icon
            const value = Math.round(eaten[macro.key])
            const target = goals[macro.key] * targetMultiplier
            const pct = target > 0 ? Math.round((value / target) * 100) : 0
            const width = Math.min(100, pct)
            return (
              <div key={macro.key} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      macro.chip
                    )}
                  >
                    <Icon className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{macro.label}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {value.toLocaleString()} / {target.toLocaleString()}{" "}
                      {macro.unit}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      macro.text
                    )}
                  >
                    {pct}%
                  </p>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={target}
                  aria-label={`${macro.label}: ${value} of ${target} ${macro.unit}`}
                >
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r transition-all",
                      macro.bar
                    )}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meals · {selectedLabel}</CardTitle>
          <CardDescription>
            {shownMeals.length === 0
              ? isWeek
                ? "Nothing logged this week."
                : "Nothing logged on this day."
              : `${Math.round(eaten.calories).toLocaleString()} cal · ${Math.round(eaten.protein)}g protein · ${shownMeals.length} ${shownMeals.length === 1 ? "entry" : "entries"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shownMeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No meals logged{" "}
              {isWeek
                ? "this week"
                : selectedLabel === "Today"
                  ? "yet today"
                  : "on this day"}
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isWeek && <TableHead>Day</TableHead>}
                  <TableHead>Meal</TableHead>
                  <TableHead>Food</TableHead>
                  <TableHead className="text-right">Calories</TableHead>
                  <TableHead className="text-right">Protein</TableHead>
                  <TableHead className="text-right">Fiber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownMeals.map((m) => (
                  <TableRow key={m.id}>
                    {isWeek && (
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {dayLabel(m.date)}
                      </TableCell>
                    )}
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
                    <TableCell className="text-right tabular-nums">
                      {m.fiber != null ? `${Number(m.fiber)}g` : "—"}
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

function GoalsDialog({
  goals,
  estimateLevel,
  onSaved,
}: {
  goals: NutritionGoals
  estimateLevel: EstimateLevel
  onSaved: (goals: NutritionGoals, estimateLevel: EstimateLevel) => void
}) {
  const goalsToDraft = React.useCallback(
    (g: NutritionGoals): Record<MacroKey, string> => ({
      calories: String(g.calories),
      protein: String(g.protein),
      carbs: String(g.carbs),
      fat: String(g.fat),
      fiber: String(g.fiber),
    }),
    []
  )

  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<Record<MacroKey, string>>(() =>
    goalsToDraft(goals)
  )
  const [level, setLevel] = React.useState<EstimateLevel>(estimateLevel)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset the form to the current goals each time the dialog opens.
  function onOpenChange(next: boolean) {
    if (next) {
      setDraft(goalsToDraft(goals))
      setLevel(estimateLevel)
      setError(null)
    }
    setOpen(next)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const payload: Record<MacroKey, number> = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      }
      for (const macro of MACROS) {
        const value = Number(draft[macro.key])
        if (!Number.isFinite(value) || value <= 0 || value > 100000) {
          throw new Error(
            `Enter a ${macro.label.toLowerCase()} goal between 1 and 100,000.`
          )
        }
        payload[macro.key] = Math.round(value)
      }
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, estimateLevel: level }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? "Couldn't save your goals.")
      onSaved(json.goals as NutritionGoals, json.estimateLevel as EstimateLevel)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your goals.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" className="shrink-0">
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Edit goals</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Daily goals</DialogTitle>
          <DialogDescription>
            Your targets for a single day — the bars fill toward these — and
            how the meal analyzer estimates portions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {MACROS.map((macro) => (
              <div key={macro.key} className="space-y-1.5">
                <Label htmlFor={`goal-${macro.key}`}>
                  {macro.label} ({macro.unit})
                </Label>
                <Input
                  id={`goal-${macro.key}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={draft[macro.key]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [macro.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Estimate macros on the…</Label>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {ESTIMATE_LEVELS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={level === value ? "secondary" : "ghost"}
                  className={
                    level === value ? "shadow-sm" : "text-muted-foreground"
                  }
                  onClick={() => setLevel(value)}
                  disabled={busy}
                  aria-pressed={level === value}
                >
                  {ESTIMATE_LABELS[value]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              How the AI reads an ambiguous portion in a meal photo. Low is
              conservative; high assumes larger portions.
            </p>
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
            <Button type="submit" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save goals"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
