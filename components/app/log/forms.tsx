"use client"

import * as React from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Camera, Check, Loader2, Repeat2, X } from "lucide-react"

import {
  Choice,
  ErrorText,
  Field,
  FieldGroup,
  NumberInput,
  Recents,
  SaveButton,
  Segmented,
  TextArea,
  TextInput,
  toNumber,
} from "@/components/app/log/fields"
import { useHabits } from "@/components/dashboard/habits-context"
import { TX_LABEL, type TxType } from "@/lib/app/money"
import { CARDIO, type CardioActivity } from "@/lib/app/workouts"
import { scheduleLabel, WEEKDAY_SHORT } from "@/lib/habits"
import { cn } from "@/lib/utils"

export type LogContext = {
  supabase: SupabaseClient
  userId: string
  workspace: string
  /** The phone's today, "YYYY-MM-DD". */
  today: string
  /** Close the sheet and refresh the page data. */
  done: () => void
  /** Photo taken right from the + menu, for the meal logger. */
  mealPhoto?: File | null
}

type FormProps = { ctx: LogContext }

const missingTable = (message: string) => /relation|schema cache|does not exist/i.test(message)

/** Submit wrapper: tracks busy + error so each form stays short. */
function useSave(ctx: LogContext) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  async function run(save: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error: err } = await save()
    setBusy(false)
    if (err) {
      setError(err.message)
      return false
    }
    ctx.done()
    return true
  }
  return { busy, error, setError, run }
}

function DateField({ value, onChange, label = "Date", hint }: { value: string; onChange: (v: string) => void; label?: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <TextInput type="date" value={value} onChange={(e) => onChange(e.target.value)} required />
    </Field>
  )
}

/* ----------------------------------------------------------------- Money */

const EXPENSE_CATEGORIES = [
  "Food", "Groceries", "Transportation", "Bills", "Utilities", "Housing", "Streaming",
  "Entertainment", "Shopping", "Medical", "Personal", "Business", "Gifts", "Travel", "Other",
] as const

/** A saved transaction, for editing. */
export type EditableTransaction = {
  id: string
  date: string
  amount: number
  transaction_type: TxType
  category: string | null
  description: string | null
  payment_method: string | null
}

const PAYBACK_METHODS = [
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "cash_app", label: "Cash App" },
  { value: "cash", label: "Cash" },
] as const

/**
 * Log money, or (with `existing`) edit or delete a saved transaction.
 * "Paid back" is for someone sending you money for something you already
 * logged, like a friend Zelle-ing you for dinner you put on your card.
 */
export function MoneyForm({ ctx, existing }: FormProps & { existing?: EditableTransaction }) {
  const [type, setType] = React.useState<TxType>(existing?.transaction_type ?? "expense")
  const [amount, setAmount] = React.useState(existing ? Number(existing.amount).toFixed(2) : "")
  const [description, setDescription] = React.useState(existing?.description ?? "")
  const [category, setCategory] = React.useState<string | null>(
    existing && existing.transaction_type !== "income" ? existing.category : null
  )
  const [method, setMethod] = React.useState<string | null>(existing?.payment_method ?? (existing ? null : "zelle"))
  const [date, setDate] = React.useState(existing?.date ?? ctx.today)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const { busy, error, setError, run } = useSave(ctx)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = toNumber(amount)
    if (!value || value <= 0) return setError("Enter an amount.")
    if (type === "reimbursement" && !category) return setError("Pick what it was for, so it comes off the right category.")
    const row = {
      date,
      amount: Math.round(value * 100) / 100,
      transaction_type: type,
      category: type === "income" ? "Income" : category,
      description: description.trim() || null,
      // Only paybacks ask how it came in; the others keep what they had.
      payment_method: type === "reimbursement" ? method : type === existing?.transaction_type ? (existing?.payment_method ?? null) : null,
    }
    run(() =>
      existing
        ? ctx.supabase.from("transactions").update(row).eq("id", existing.id)
        : ctx.supabase.from("transactions").insert({ ...row, workspace: ctx.workspace })
    )
  }

  function remove() {
    if (!existing) return
    if (!confirmDelete) return setConfirmDelete(true)
    run(() => ctx.supabase.from("transactions").delete().eq("id", existing.id))
  }

  const placeholder = { expense: "Chipotle", income: "Paycheck", reimbursement: "Alex for dinner" }[type]

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Segmented
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
          { value: "reimbursement", label: "Paid back" },
        ] as const}
        value={type}
        onChange={(t) => {
          setType(t)
          setConfirmDelete(false)
        }}
      />
      {type === "reimbursement" && (
        <p className="-mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Someone paying you back for something you already logged. It lowers your spending instead of counting as income.
        </p>
      )}
      <Field label="Amount">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-neutral-500">$</span>
          <NumberInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-14 pl-8 text-2xl tabular-nums" />
        </div>
      </Field>
      <Field label={type === "reimbursement" ? "Who / what for" : "What for"}>
        <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder={placeholder} />
      </Field>
      {type === "reimbursement" && (
        <FieldGroup label="How">
          <Choice options={PAYBACK_METHODS as readonly { value: string; label: string }[]} value={method} onChange={(m) => setMethod(m === method ? null : m)} />
        </FieldGroup>
      )}
      {type !== "income" && (
        <FieldGroup label={type === "reimbursement" ? "It was for" : "Category"}>
          <Choice
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            value={category}
            onChange={(c) => {
              setCategory(c)
              setError(null)
            }}
          />
        </FieldGroup>
      )}
      <DateField value={date} onChange={setDate} />
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy}>{existing ? "Save changes" : `Save ${TX_LABEL[type].toLowerCase()}`}</SaveButton>
      {existing && (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className={cn(
            "h-12 cursor-pointer rounded-xl text-base font-medium transition-colors disabled:opacity-50",
            confirmDelete
              ? "bg-red-600 text-white active:bg-red-700"
              : "bg-neutral-100 text-red-600 active:bg-neutral-200 dark:bg-neutral-800 dark:text-red-400"
          )}
        >
          {confirmDelete ? "Tap again to delete" : "Delete transaction"}
        </button>
      )}
    </form>
  )
}

/* --------------------------------------------------------------- Workout */

type LiftRow = { exercise: string; sets: number | null; reps: number | null; weight: number | null; unit: string | null }

export function WorkoutForm({ ctx }: FormProps) {
  const [mode, setMode] = React.useState<"lift" | "run" | CardioActivity>("lift")
  const [exercise, setExercise] = React.useState("")
  const [sets, setSets] = React.useState("3")
  const [reps, setReps] = React.useState("")
  const [weight, setWeight] = React.useState("")
  const [unit, setUnit] = React.useState<"lbs" | "kg" | "bodyweight">("lbs")
  const [miles, setMiles] = React.useState("")
  const [minutes, setMinutes] = React.useState("")
  const [swimUnit, setSwimUnit] = React.useState<"yd" | "m">("yd")
  const [date, setDate] = React.useState(ctx.today)
  const [recent, setRecent] = React.useState<LiftRow[]>([])
  const { busy, error, setError, run } = useSave(ctx)

  // Last time's numbers for each exercise, so repeating a lift is two taps.
  React.useEffect(() => {
    let cancelled = false
    ctx.supabase
      .from("gym_weight")
      .select("exercise, sets, reps, weight, unit")
      .eq("workspace", ctx.workspace)
      .order("date", { ascending: false })
      .limit(80)
      .then(({ data }) => {
        if (cancelled || !data) return
        const seen = new Map<string, LiftRow>()
        for (const row of data as LiftRow[]) if (!seen.has(row.exercise)) seen.set(row.exercise, row)
        setRecent([...seen.values()].slice(0, 12))
      })
    return () => {
      cancelled = true
    }
  }, [ctx.supabase, ctx.workspace])

  function pick(name: string) {
    const last = recent.find((r) => r.exercise === name)
    setExercise(name)
    if (!last) return
    if (last.sets) setSets(String(last.sets))
    if (last.reps) setReps(String(last.reps))
    if (last.weight != null) setWeight(String(last.weight))
    if (last.unit === "lbs" || last.unit === "kg" || last.unit === "bodyweight") setUnit(last.unit)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode !== "lift" && mode !== "run") {
      const distance = toNumber(miles)
      const mins = toNumber(minutes)
      if ((distance === null || distance <= 0) && (mins === null || mins <= 0)) {
        return setError("Enter a distance or how long it took.")
      }
      return run(async () => {
        const res = await ctx.supabase.from("cardio").insert({
          user_id: ctx.userId,
          workspace: ctx.workspace,
          date,
          activity: mode,
          distance: distance && distance > 0 ? distance : null,
          distance_unit: mode === "swim" ? swimUnit : "mi",
          duration_seconds: mins && mins > 0 ? Math.round(mins * 60) : null,
        })
        if (res.error && missingTable(res.error.message)) {
          return { error: { message: "Bike rides and swims need the cardio SQL run in Supabase first." } }
        }
        if (res.error && /check constraint|activity/i.test(res.error.message)) {
          return { error: { message: "Walks and hikes need the new SQL run in Supabase first (paid back + walk/hike)." } }
        }
        return res
      })
    }
    if (mode === "run") {
      const distance = toNumber(miles)
      const mins = toNumber(minutes)
      if (!distance || distance <= 0) return setError("Enter how far you ran.")
      if (!mins || mins <= 0) return setError("Enter how long it took.")
      return run(() =>
        ctx.supabase.from("runs").insert({
          user_id: ctx.userId,
          workspace: ctx.workspace,
          date,
          distance_miles: distance,
          duration_seconds: Math.round(mins * 60),
        })
      )
    }
    if (!exercise.trim()) return setError("Enter an exercise.")
    const w = unit === "bodyweight" ? null : toNumber(weight)
    run(() =>
      ctx.supabase.from("gym_weight").insert({
        user_id: ctx.userId,
        workspace: ctx.workspace,
        date,
        exercise: exercise.trim(),
        sets: toNumber(sets),
        reps: toNumber(reps),
        weight: w,
        unit,
        personal_record: false,
      })
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Segmented
        options={[
          { value: "lift", label: "Lift" },
          { value: "run", label: "Run" },
          ...(Object.keys(CARDIO) as CardioActivity[]).map((k) => ({ value: k, label: CARDIO[k].label })),
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === "lift" ? (
        <>
          <Recents items={recent.map((r) => ({ key: r.exercise, label: r.exercise }))} onPick={pick} />
          <Field label="Exercise">
            <TextInput value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="Bench Press" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Sets"><NumberInput value={sets} onChange={(e) => setSets(e.target.value)} inputMode="numeric" /></Field>
            <Field label="Reps"><NumberInput value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" placeholder="8" /></Field>
            <Field label="Weight">
              <NumberInput value={unit === "bodyweight" ? "" : weight} onChange={(e) => setWeight(e.target.value)} disabled={unit === "bodyweight"} placeholder={unit === "bodyweight" ? "BW" : "135"} />
            </Field>
          </div>
          <Choice options={[{ value: "lbs", label: "lbs" }, { value: "kg", label: "kg" }, { value: "bodyweight", label: "Bodyweight" }] as const} value={unit} onChange={setUnit} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distance" hint={mode === "swim" ? swimUnit : "miles"}>
              <NumberInput
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                placeholder={{ run: "3.1", bike: "12", swim: "1000", walk: "2", hike: "5" }[mode]}
              />
            </Field>
            <Field label="Time" hint="minutes">
              <NumberInput value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder={{ run: "28", bike: "45", swim: "28", walk: "40", hike: "120" }[mode]} />
            </Field>
          </div>
          {mode === "swim" && (
            <Choice options={[{ value: "yd", label: "Yards" }, { value: "m", label: "Meters" }] as const} value={swimUnit} onChange={setSwimUnit} />
          )}
        </>
      )}
      <DateField value={date} onChange={setDate} />
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy}>{{ lift: "Save lift", run: "Save run", bike: "Save ride", swim: "Save swim", walk: "Save walk", hike: "Save hike" }[mode]}</SaveButton>
    </form>
  )
}

/* --------------------------------------------------------------- Journal */

const MOODS = ["happy", "motivated", "neutral", "tired", "stressed", "anxious", "sad", "angry"] as const

export function JournalForm({ ctx }: FormProps) {
  const [title, setTitle] = React.useState("")
  const [entry, setEntry] = React.useState("")
  const [mood, setMood] = React.useState<(typeof MOODS)[number] | null>(null)
  const [date, setDate] = React.useState(ctx.today)
  const { busy, error, setError, run } = useSave(ctx)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!entry.trim()) return setError("Write something first.")
    run(() =>
      ctx.supabase.from("journal").insert({
        user_id: ctx.userId,
        workspace: ctx.workspace,
        date,
        title: title.trim() || null,
        entry: entry.trim(),
        mood,
      })
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Title" hint="optional">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Entry">
        <TextArea value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="How was today?" />
      </Field>
      <FieldGroup label="Mood">
        <Choice options={MOODS.map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }))} value={mood} onChange={setMood} />
      </FieldGroup>
      <DateField value={date} onChange={setDate} />
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy}>Save entry</SaveButton>
    </form>
  )
}

/* ----------------------------------------------------------------- Sleep */

export function SleepForm({ ctx }: FormProps) {
  const [hours, setHours] = React.useState("")
  const [minutes, setMinutes] = React.useState("")
  const [score, setScore] = React.useState("")
  const [date, setDate] = React.useState(ctx.today)
  const { busy, error, setError, run } = useSave(ctx)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const h = toNumber(hours) ?? 0
    const m = toNumber(minutes) ?? 0
    const total = h + m / 60
    const s = toNumber(score)
    if (total <= 0 && s === null) return setError("Enter how long you slept or your score.")
    if (total > 24) return setError("That's more than 24 hours.")
    if (s !== null && (s < 0 || s > 100)) return setError("Score should be 0–100.")
    run(() =>
      ctx.supabase.from("sleep").upsert(
        {
          user_id: ctx.userId,
          workspace: ctx.workspace,
          date,
          hours: total > 0 ? Math.round(total * 100) / 100 : null,
          score: s === null ? null : Math.round(s),
        },
        // One entry per night: logging the same date again replaces it.
        { onConflict: "user_id,workspace,date" }
      )
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hours"><NumberInput value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" placeholder="7" /></Field>
        <Field label="Minutes"><NumberInput value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" placeholder="30" /></Field>
      </div>
      <Field label="Sleep score" hint="optional, 0–100">
        <NumberInput value={score} onChange={(e) => setScore(e.target.value)} inputMode="numeric" placeholder="82" />
      </Field>
      <DateField value={date} onChange={setDate} label="Woke up on" hint="saving the same day again replaces it" />
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy}>Save sleep</SaveButton>
    </form>
  )
}

/* ---------------------------------------------------------------- Weight */

export function WeightForm({ ctx }: FormProps) {
  const [weight, setWeight] = React.useState("")
  const [unit, setUnit] = React.useState<"lbs" | "kg">("lbs")
  const [date, setDate] = React.useState(ctx.today)
  const [last, setLast] = React.useState<{ weight: number; date: string } | null>(null)
  const { busy, error, setError, run } = useSave(ctx)

  React.useEffect(() => {
    let cancelled = false
    ctx.supabase
      .from("personal_weight")
      .select("weight, unit, date")
      .eq("workspace", ctx.workspace)
      .not("weight", "is", null)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setLast({ weight: Number(data.weight), date: data.date as string })
        if (data.unit === "kg") setUnit("kg")
      })
    return () => {
      cancelled = true
    }
  }, [ctx.supabase, ctx.workspace])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const w = toNumber(weight)
    if (!w || w <= 0) return setError("Enter your weight.")
    run(() =>
      ctx.supabase.from("personal_weight").insert({
        user_id: ctx.userId,
        workspace: ctx.workspace,
        date,
        weight: w,
        unit,
      })
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Weight" hint={last ? `last: ${last.weight} ${unit === "kg" ? "kg" : "lb"}` : undefined}>
        <NumberInput value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={last ? String(last.weight) : "165"} className="h-14 text-2xl tabular-nums" />
      </Field>
      <Choice options={[{ value: "lbs", label: "lbs" }, { value: "kg", label: "kg" }] as const} value={unit} onChange={setUnit} />
      <DateField value={date} onChange={setDate} />
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy}>Save weigh-in</SaveButton>
    </form>
  )
}

/* ------------------------------------------------------------- Nutrition */

const MEALS = ["breakfast", "lunch", "dinner", "snack", "drink"] as const
type Meal = (typeof MEALS)[number]
type RecentMeal = { food_name: string; meal_type: string | null; calories: number | null; protein: number | null; carbs: number | null; fat: number | null }

function mealForNow(): Meal {
  const h = new Date().getHours()
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 21 ? "dinner" : "snack"
}

// Phone photos are often 5–12MB; shrink before uploading so analysis is fast
// and cheap. Same approach as the old dashboard's meal snap.
async function downscale(file: File, maxDim = 1280): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.85))
  } catch {
    return file
  }
}

type Estimate = {
  food_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  portion_size: string
  notes: string
}

export function NutritionForm({ ctx }: FormProps) {
  const [food, setFood] = React.useState("")
  const [meal, setMeal] = React.useState<Meal>(mealForNow)
  const [calories, setCalories] = React.useState("")
  const [protein, setProtein] = React.useState("")
  const [carbs, setCarbs] = React.useState("")
  const [fat, setFat] = React.useState("")
  const [fiber, setFiber] = React.useState("")
  const [portion, setPortion] = React.useState<string | null>(null)
  const [aiNote, setAiNote] = React.useState<string | null>(null)
  const [date, setDate] = React.useState(ctx.today)
  const [recent, setRecent] = React.useState<RecentMeal[]>([])
  const [preview, setPreview] = React.useState<string | null>(null)
  const [analyzing, setAnalyzing] = React.useState(false)
  const retakeInput = React.useRef<HTMLInputElement>(null)
  const { busy, error, setError, run } = useSave(ctx)

  React.useEffect(() => {
    let cancelled = false
    ctx.supabase
      .from("nutrition")
      .select("food_name, meal_type, calories, protein, carbs, fat")
      .eq("workspace", ctx.workspace)
      .order("date", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (cancelled || !data) return
        const seen = new Map<string, RecentMeal>()
        for (const row of data as RecentMeal[]) if (!seen.has(row.food_name)) seen.set(row.food_name, row)
        setRecent([...seen.values()].slice(0, 12))
      })
    return () => {
      cancelled = true
    }
  }, [ctx.supabase, ctx.workspace])

  const analyze = React.useCallback(
    async (file: File) => {
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(file)
      })
      setAnalyzing(true)
      setError(null)
      // The estimate level ("low", "middle", "high") is set once in Settings.
      const { data: settings } = await ctx.supabase.from("user_settings").select("estimate_level").maybeSingle()
      const body = new FormData()
      body.append("image", await downscale(file), "meal.jpg")
      body.append("name", "")
      body.append("details", "")
      body.append("estimate", (settings?.estimate_level as string | undefined) ?? "low")
      try {
        const res = await fetch("/api/analyze-meal", { method: "POST", body })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? "Couldn't read that photo.")
        const e = json as Estimate
        setFood(e.food_name)
        setCalories(String(Math.round(e.calories)))
        setProtein(String(e.protein))
        setCarbs(String(e.carbs))
        setFat(String(e.fat))
        setFiber(String(e.fiber))
        setPortion(e.portion_size || null)
        setAiNote(e.notes || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't read that photo.")
      } finally {
        setAnalyzing(false)
      }
    },
    [ctx.supabase, setError]
  )

  // A photo taken straight from the + menu arrives here.
  const handled = React.useRef<File | null>(null)
  React.useEffect(() => {
    const photo = ctx.mealPhoto
    if (!photo || handled.current === photo) return
    handled.current = photo
    void analyze(photo)
  }, [ctx.mealPhoto, analyze])

  function pick(name: string) {
    const r = recent.find((x) => x.food_name === name)
    if (!r) return
    setFood(r.food_name)
    setCalories(r.calories != null ? String(Math.round(r.calories)) : "")
    setProtein(r.protein != null ? String(r.protein) : "")
    setCarbs(r.carbs != null ? String(r.carbs) : "")
    setFat(r.fat != null ? String(r.fat) : "")
    setFiber("")
    setPortion(null)
    setAiNote(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!food.trim()) return setError("What did you eat?")
    const cal = toNumber(calories)
    run(() =>
      ctx.supabase.from("nutrition").insert({
        user_id: ctx.userId,
        workspace: ctx.workspace,
        date,
        meal_type: meal,
        food_name: food.trim(),
        calories: cal === null ? null : Math.round(cal),
        protein: toNumber(protein),
        carbs: toNumber(carbs),
        fat: toNumber(fat),
        fiber: toNumber(fiber),
        portion_size: portion,
        notes: aiNote,
      })
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* Photo: tap to (re)take; the AI fills in the fields below. */}
      <input
        ref={retakeInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (file) void analyze(file)
        }}
      />
      <button
        type="button"
        onClick={() => retakeInput.current?.click()}
        disabled={analyzing}
        className="relative flex min-h-14 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl bg-neutral-100 p-2 text-left dark:bg-neutral-800"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={preview} alt="Your meal" className="size-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#318E63] text-white">
            <Camera className="size-5" />
          </span>
        )}
        <span className="flex-1 text-[15px] text-neutral-900 dark:text-neutral-100">
          {analyzing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Estimating calories…
            </span>
          ) : preview ? (
            <>
              Estimated from your photo
              <span className="block text-sm text-neutral-500 dark:text-neutral-400">Check the numbers · tap to retake</span>
            </>
          ) : (
            "Take a photo of your meal"
          )}
        </span>
      </button>
      {!preview && <Recents items={recent.map((r) => ({ key: r.food_name, label: r.food_name }))} onPick={pick} />}
      <Field label="Food" hint={portion ?? undefined}>
        <TextInput value={food} onChange={(e) => setFood(e.target.value)} placeholder="Chicken burrito bowl" />
      </Field>
      <Choice options={MEALS.map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }))} value={meal} onChange={setMeal} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories"><NumberInput value={calories} onChange={(e) => setCalories(e.target.value)} inputMode="numeric" placeholder="650" /></Field>
        <Field label="Protein" hint="g"><NumberInput value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="40" /></Field>
        <Field label="Carbs" hint="g"><NumberInput value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="60" /></Field>
        <Field label="Fat" hint="g"><NumberInput value={fat} onChange={(e) => setFat(e.target.value)} placeholder="20" /></Field>
        <Field label="Fiber" hint="g"><NumberInput value={fiber} onChange={(e) => setFiber(e.target.value)} placeholder="8" /></Field>
      </div>
      {aiNote && <p className="text-sm text-neutral-500 dark:text-neutral-400">{aiNote}</p>}
      <DateField value={date} onChange={setDate} />
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy} disabled={analyzing}>Save meal</SaveButton>
    </form>
  )
}

/* ------------------------------------------------------------ Supplement */

type Stack = { id: string; name: string; dose: number | null; unit: string | null }
const UNITS = ["mg", "g", "mcg", "IU", "ml", "capsule", "tablet", "scoop", "serving"] as const

export function SupplementForm({ ctx }: FormProps) {
  const [stack, setStack] = React.useState<Stack[]>([])
  const [takenToday, setTakenToday] = React.useState<Set<string>>(new Set())
  const [ready, setReady] = React.useState<boolean | null>(null)
  const [name, setName] = React.useState("")
  const [dose, setDose] = React.useState("")
  const [unit, setUnit] = React.useState<(typeof UNITS)[number] | null>(null)
  const [saveToStack, setSaveToStack] = React.useState(true)
  const { busy, error, setError, run } = useSave(ctx)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      ctx.supabase
        .from("supplements")
        .select("id, name, dose, unit")
        .eq("workspace", ctx.workspace)
        .eq("is_active", true)
        .order("position", { ascending: true }),
      ctx.supabase.from("supplement_logs").select("name").eq("workspace", ctx.workspace).eq("date", ctx.today),
    ]).then(([s, logs]) => {
      if (cancelled) return
      if (s.error && missingTable(s.error.message)) return setReady(false)
      setReady(true)
      setStack(((s.data ?? []) as Stack[]).map((x) => ({ ...x, dose: x.dose == null ? null : Number(x.dose) })))
      setTakenToday(new Set(((logs.data ?? []) as { name: string }[]).map((l) => l.name)))
    })
    return () => {
      cancelled = true
    }
  }, [ctx.supabase, ctx.workspace, ctx.today])

  async function logOne(item: { id?: string; name: string; dose: number | null; unit: string | null }) {
    const { error: err } = await ctx.supabase.from("supplement_logs").insert({
      user_id: ctx.userId,
      workspace: ctx.workspace,
      supplement_id: item.id ?? null,
      name: item.name,
      dose: item.dose,
      unit: item.unit,
      date: ctx.today,
    })
    return err
  }

  async function tapStack(item: Stack) {
    setError(null)
    const err = await logOne(item)
    if (err) return setError(err.message)
    setTakenToday((prev) => new Set(prev).add(item.name))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError("Which supplement?")
    const item = { name: name.trim(), dose: toNumber(dose), unit }
    run(async () => {
      let id: string | undefined
      if (saveToStack && !stack.some((s) => s.name.toLowerCase() === item.name.toLowerCase())) {
        const res = await ctx.supabase
          .from("supplements")
          .insert({ user_id: ctx.userId, workspace: ctx.workspace, ...item, position: stack.length })
          .select("id")
          .single()
        if (res.error) return { error: res.error }
        id = res.data.id as string
      }
      const err = await logOne({ ...item, id })
      return { error: err }
    })
  }

  if (ready === false) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Supplements aren&apos;t set up yet. Run the supplements SQL in Supabase, then come back.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {stack.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Your stack · tap to log for today</span>
          <ul className="overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
            {stack.map((s) => {
              const taken = takenToday.has(s.name)
              return (
                <li key={s.id} className="border-t border-white first:border-t-0 dark:border-neutral-900">
                  <button
                    type="button"
                    onClick={() => !taken && tapStack(s)}
                    className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 text-left"
                  >
                    <span className={cn("flex size-5 items-center justify-center rounded-full border-[1.5px]", taken ? "border-[#318E63] bg-[#318E63] text-white" : "border-neutral-400 dark:border-neutral-600")}>
                      {taken && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 text-[15px] text-neutral-900 dark:text-neutral-100">{s.name}</span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">{s.dose != null ? `${s.dose} ${s.unit ?? ""}` : ""}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{stack.length ? "Something else" : "Log a supplement"}</span>
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Creatine" />
      </Field>
      <Field label="Dose" hint="optional">
        <NumberInput value={dose} onChange={(e) => setDose(e.target.value)} placeholder="5" />
      </Field>
      <Choice options={UNITS.map((u) => ({ value: u, label: u }))} value={unit} onChange={setUnit} />
      <label className="flex min-h-11 items-center gap-3 text-[15px] text-neutral-900 dark:text-neutral-100">
        <input type="checkbox" checked={saveToStack} onChange={(e) => setSaveToStack(e.target.checked)} className="size-5 accent-[#318E63]" />
        Add to my stack for one-tap logging
      </label>
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy}>Log it</SaveButton>
    </form>
  )
}

/* ----------------------------------------------------------------- Notes */

export function NotesForm({ ctx }: FormProps) {
  const [content, setContent] = React.useState<string | null>(null)
  const { busy, error, run } = useSave(ctx)

  React.useEffect(() => {
    let cancelled = false
    ctx.supabase
      .from("notes")
      .select("content")
      .eq("workspace", ctx.workspace)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setContent((data?.content as string | undefined) ?? "")
      })
    return () => {
      cancelled = true
    }
  }, [ctx.supabase, ctx.workspace])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    run(() =>
      ctx.supabase.from("notes").upsert(
        { user_id: ctx.userId, workspace: ctx.workspace, content: content ?? "", updated_at: new Date().toISOString() },
        { onConflict: "user_id,workspace" }
      )
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">The same notes as the old dashboard&apos;s scratchpad.</p>
      <TextArea
        value={content ?? ""}
        onChange={(e) => setContent(e.target.value)}
        disabled={content === null}
        placeholder={content === null ? "Loading…" : "Jot anything down"}
        className="min-h-60"
      />
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy} disabled={content === null}>Save notes</SaveButton>
    </form>
  )
}

/* ------------------------------------------------------------------ Task */

type Todo = { id: string; text: string; done: boolean }

type Repeat = "once" | "daily" | "days"
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]

export function TaskForm({ ctx }: FormProps) {
  const { habits, addHabit, removeHabit } = useHabits()
  const [text, setText] = React.useState("")
  const [repeat, setRepeat] = React.useState<Repeat>("once")
  const [days, setDays] = React.useState<number[]>([])
  const [todos, setTodos] = React.useState<Todo[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    ctx.supabase
      .from("todos")
      .select("id, text, done")
      .eq("workspace", ctx.workspace)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setTodos((data ?? []) as Todo[])
      })
    return () => {
      cancelled = true
    }
  }, [ctx.supabase, ctx.workspace])

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return setError("What's the task?")
    if (repeat === "days" && days.length === 0) return setError("Pick at least one day.")
    setError(null)
    setSaving(true)

    if (repeat === "once") {
      // One-off: a plain to-do.
      const { data, error: err } = await ctx.supabase
        .from("todos")
        .insert({ user_id: ctx.userId, workspace: ctx.workspace, text: value, done: false })
        .select("id, text, done")
        .single()
      setSaving(false)
      if (err) return setError(err.message)
      setTodos((prev) => [...prev, data as Todo])
    } else {
      // Repeating: becomes a habit, so it shows in Daily Habits on the days it's due.
      const err = await addHabit(value, "listtodo", repeat === "days" && days.length < 7 ? days : null)
      setSaving(false)
      if (err) return setError(err)
    }
    setText("")
  }

  async function toggle(todo: Todo) {
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)))
    const { error: err } = await ctx.supabase.from("todos").update({ done: !todo.done }).eq("id", todo.id)
    if (err) {
      setError(err.message)
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)))
    }
  }

  const open = todos.filter((t) => !t.done)
  const finished = todos.filter((t) => t.done).slice(-5)

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={add} className="flex flex-col gap-4">
        <Field label="Task">
          <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Clean room" />
        </Field>
        <FieldGroup label="How often">
          <Segmented
            options={[
              { value: "once", label: "Once" },
              { value: "daily", label: "Every day" },
              { value: "days", label: "Certain days" },
            ] as const}
            value={repeat}
            onChange={setRepeat}
          />
        </FieldGroup>
        {repeat === "days" && (
          <div className="flex justify-between gap-1.5" role="group" aria-label="Days of the week">
            {WEEKDAY_LETTERS.map((letter, d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                aria-pressed={days.includes(d)}
                aria-label={WEEKDAY_SHORT[d]}
                className={cn(
                  "flex size-11 cursor-pointer items-center justify-center rounded-full text-sm font-medium transition-colors",
                  days.includes(d)
                    ? "bg-[#318E63] text-white"
                    : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                )}
              >
                {letter}
              </button>
            ))}
          </div>
        )}
        {repeat !== "once" && (
          <p className="-mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Shows up in Daily Habits on Today{repeat === "days" && days.length ? ` · ${scheduleLabel(days)}` : " every day"}.
          </p>
        )}
        <ErrorText>{error}</ErrorText>
        <SaveButton busy={saving}>{repeat === "once" ? "Add task" : "Add repeating task"}</SaveButton>
      </form>

      {habits.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Repeating</span>
          <ul className="overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
            {habits.map((h) => (
              <li key={h.id} className="flex min-h-12 items-center gap-3 border-t border-white px-4 first:border-t-0 dark:border-neutral-900">
                <Repeat2 className="size-4 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1 truncate text-[15px] text-neutral-900 dark:text-neutral-100">{h.name}</span>
                <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{scheduleLabel(h.days)}</span>
                <button
                  type="button"
                  onClick={() => removeHabit(h.id)}
                  aria-label={`Remove ${h.name}`}
                  className="-mr-2 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-400 active:bg-neutral-200 dark:active:bg-neutral-700"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {[...open, ...finished].length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">To-do</span>
          <ul className="overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
            {[...open, ...finished].map((t) => (
              <li key={t.id} className="border-t border-white first:border-t-0 dark:border-neutral-900">
                <button type="button" onClick={() => toggle(t)} className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 text-left">
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px]", t.done ? "border-[#318E63] bg-[#318E63] text-white" : "border-neutral-400 dark:border-neutral-600")}>
                    {t.done && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className={cn("text-[15px]", t.done ? "text-neutral-400 line-through dark:text-neutral-500" : "text-neutral-900 dark:text-neutral-100")}>
                    {t.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" onClick={ctx.done} className="h-12 cursor-pointer rounded-xl bg-neutral-100 text-base text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
        Done
      </button>
    </div>
  )
}
