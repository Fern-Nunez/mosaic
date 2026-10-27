"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"

import {
  Choice,
  ErrorText,
  Field,
  FieldGroup,
  NumberInput,
  SaveButton,
  TextArea,
  TextInput,
  toNumber,
} from "@/components/app/log/fields"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import type { TrendData } from "@/lib/app/trend-data"
import { CARDIO, type CardioActivity } from "@/lib/app/workouts"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

/** A saved entry from one of the category pages, ready to edit. */
export type EntryEdit =
  | { table: "nutrition"; row: TrendData["nutrition"][number] }
  | { table: "gym_weight"; row: TrendData["gym"][number] }
  | { table: "runs"; row: TrendData["runs"][number] }
  | { table: "cardio"; row: TrendData["cardio"][number] }
  | { table: "sleep"; row: TrendData["sleep"][number] }
  | { table: "personal_weight"; row: TrendData["weights"][number] }
  | { table: "journal"; row: TrendData["journal"][number] }
  | { table: "supplement_logs"; row: TrendData["supplements"][number] }

type Values = Record<string, string>

type FieldDef = {
  key: string
  label: string
  kind: "text" | "number" | "date" | "textarea" | "choice"
  options?: readonly { value: string; label: string }[]
  hint?: string
  required?: boolean
  /** Shares a row with the next "half" field. */
  half?: boolean
  /** Choice only: tapping the picked one again clears it. */
  clearable?: boolean
}

const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))
const str = (v: unknown) => (v == null ? "" : String(v))
const minutes = (s: number | null | undefined) => (s ? String(Math.round((s / 60) * 10) / 10) : "")

const MEALS = ["breakfast", "lunch", "dinner", "snack", "drink"] as const
const MOODS = ["happy", "motivated", "neutral", "tired", "stressed", "anxious", "sad", "angry"] as const
const DOSE_UNITS = ["mg", "g", "mcg", "IU", "ml", "capsule", "tablet", "scoop", "serving"] as const

/**
 * Per table: the sheet title, which fields to show, how a saved row fills
 * them, and how they turn back into a row. Number fields left empty save
 * as null; "minutes" fields are stored as seconds.
 */
const SCHEMAS: {
  [T in EntryEdit["table"]]: {
    title: (row: Extract<EntryEdit, { table: T }>["row"]) => string
    fields: FieldDef[]
    load: (row: Extract<EntryEdit, { table: T }>["row"]) => Values
    save: (v: Values) => { row?: Record<string, unknown>; error?: string }
  }
} = {
  nutrition: {
    title: () => "Edit meal",
    fields: [
      { key: "food_name", label: "Food", kind: "text", required: true },
      { key: "meal_type", label: "Meal", kind: "choice", options: opts(MEALS), clearable: true },
      { key: "calories", label: "Calories", kind: "number", half: true },
      { key: "protein", label: "Protein", kind: "number", hint: "g", half: true },
      { key: "carbs", label: "Carbs", kind: "number", hint: "g", half: true },
      { key: "fat", label: "Fat", kind: "number", hint: "g", half: true },
      { key: "fiber", label: "Fiber", kind: "number", hint: "g", half: true },
      { key: "date", label: "Date", kind: "date" },
    ],
    load: (r) => ({
      food_name: r.food_name, meal_type: str(r.meal_type), calories: str(r.calories), protein: str(r.protein),
      carbs: str(r.carbs), fat: str(r.fat), fiber: str(r.fiber), date: r.date,
    }),
    save: (v) => {
      const cal = toNumber(v.calories)
      return {
        row: {
          food_name: v.food_name.trim(), meal_type: v.meal_type || null, calories: cal == null ? null : Math.round(cal),
          protein: toNumber(v.protein), carbs: toNumber(v.carbs), fat: toNumber(v.fat), fiber: toNumber(v.fiber), date: v.date,
        },
      }
    },
  },
  gym_weight: {
    title: () => "Edit lift",
    fields: [
      { key: "exercise", label: "Exercise", kind: "text", required: true },
      { key: "sets", label: "Sets", kind: "number", half: true },
      { key: "reps", label: "Reps", kind: "number", half: true },
      { key: "weight", label: "Weight", kind: "number", half: true },
      { key: "unit", label: "Unit", kind: "choice", options: [{ value: "lbs", label: "lbs" }, { value: "kg", label: "kg" }, { value: "bodyweight", label: "Bodyweight" }] },
      { key: "date", label: "Date", kind: "date" },
    ],
    load: (r) => ({ exercise: r.exercise, sets: str(r.sets), reps: str(r.reps), weight: str(r.weight), unit: str(r.unit) || "lbs", date: r.date }),
    save: (v) => ({
      row: {
        exercise: v.exercise.trim(), sets: toNumber(v.sets), reps: toNumber(v.reps),
        weight: v.unit === "bodyweight" ? null : toNumber(v.weight), unit: v.unit || "lbs", date: v.date,
      },
    }),
  },
  runs: {
    title: () => "Edit run",
    fields: [
      { key: "distance_miles", label: "Distance", kind: "number", hint: "miles", half: true, required: true },
      { key: "minutes", label: "Time", kind: "number", hint: "minutes", half: true, required: true },
      { key: "date", label: "Date", kind: "date" },
    ],
    load: (r) => ({ distance_miles: str(r.distance_miles), minutes: minutes(r.duration_seconds), date: r.date }),
    save: (v) => {
      const d = toNumber(v.distance_miles)
      const m = toNumber(v.minutes)
      if (!d || d <= 0 || !m || m <= 0) return { error: "A run needs a distance and a time." }
      return { row: { distance_miles: d, duration_seconds: Math.round(m * 60), date: v.date } }
    },
  },
  cardio: {
    title: (r) => `Edit ${CARDIO[r.activity].noun.toLowerCase()}`,
    fields: [
      { key: "activity", label: "Type", kind: "choice", options: (Object.keys(CARDIO) as CardioActivity[]).map((a) => ({ value: a, label: CARDIO[a].label })) },
      { key: "distance", label: "Distance", kind: "number", half: true },
      { key: "minutes", label: "Time", kind: "number", hint: "minutes", half: true },
      { key: "distance_unit", label: "Distance in", kind: "choice", options: [{ value: "mi", label: "Miles" }, { value: "yd", label: "Yards" }, { value: "m", label: "Meters" }] },
      { key: "date", label: "Date", kind: "date" },
    ],
    load: (r) => ({ activity: r.activity, distance: str(r.distance), minutes: minutes(r.duration_seconds), distance_unit: str(r.distance_unit) || "mi", date: r.date }),
    save: (v) => {
      const d = toNumber(v.distance)
      const m = toNumber(v.minutes)
      if ((!d || d <= 0) && (!m || m <= 0)) return { error: "Enter a distance or a time." }
      return {
        row: {
          activity: v.activity, distance: d && d > 0 ? d : null, distance_unit: v.distance_unit || null,
          duration_seconds: m && m > 0 ? Math.round(m * 60) : null, date: v.date,
        },
      }
    },
  },
  sleep: {
    title: () => "Edit sleep",
    fields: [
      { key: "hours", label: "Hours", kind: "number", half: true },
      { key: "score", label: "Score", kind: "number", hint: "optional", half: true },
      { key: "date", label: "Morning of", kind: "date" },
    ],
    load: (r) => ({ hours: str(r.hours), score: str(r.score), date: r.date }),
    save: (v) => {
      const h = toNumber(v.hours)
      const sc = toNumber(v.score)
      if ((h == null || h <= 0) && sc == null) return { error: "Enter hours or a score." }
      if (h != null && (h < 0 || h > 24)) return { error: "Hours should be between 0 and 24." }
      if (sc != null && (sc < 0 || sc > 100)) return { error: "Score should be 0 to 100." }
      return { row: { hours: h != null && h > 0 ? Math.round(h * 100) / 100 : null, score: sc == null ? null : Math.round(sc), date: v.date } }
    },
  },
  personal_weight: {
    title: () => "Edit weigh-in",
    fields: [
      { key: "weight", label: "Weight", kind: "number", required: true },
      { key: "unit", label: "Unit", kind: "choice", options: [{ value: "lbs", label: "lbs" }, { value: "kg", label: "kg" }] },
      { key: "date", label: "Date", kind: "date" },
    ],
    load: (r) => ({ weight: str(r.weight), unit: r.unit === "kg" ? "kg" : "lbs", date: r.date }),
    save: (v) => {
      const w = toNumber(v.weight)
      if (!w || w <= 0) return { error: "Enter a weight." }
      return { row: { weight: w, unit: v.unit || "lbs", date: v.date } }
    },
  },
  journal: {
    title: () => "Edit journal entry",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "entry", label: "Entry", kind: "textarea", required: true },
      { key: "mood", label: "Mood", kind: "choice", options: opts(MOODS), clearable: true },
      { key: "date", label: "Date", kind: "date" },
    ],
    load: (r) => ({ title: str(r.title), entry: r.entry ?? "", mood: r.mood && r.mood !== "unknown" ? r.mood : "", date: r.date }),
    save: (v) => ({ row: { title: v.title.trim() || null, entry: v.entry.trim(), mood: v.mood || null, date: v.date } }),
  },
  supplement_logs: {
    title: () => "Edit dose",
    fields: [
      { key: "name", label: "Supplement", kind: "text", required: true },
      { key: "dose", label: "Dose", kind: "number", hint: "optional" },
      { key: "unit", label: "Unit", kind: "choice", options: DOSE_UNITS.map((u) => ({ value: u, label: u })), clearable: true },
      { key: "date", label: "Date", kind: "date" },
    ],
    load: (r) => ({ name: r.name, dose: str(r.dose), unit: str(r.unit), date: r.date }),
    save: (v) => ({ row: { name: v.name.trim(), dose: toNumber(v.dose), unit: v.unit || null, date: v.date } }),
  },
}

/** Bottom sheet to change or delete any logged entry. */
export function EntryEditor({ target, onClose }: { target: EntryEdit | null; onClose: () => void }) {
  const sheetRef = React.useRef<HTMLDivElement>(null)
  // Keep the last one on screen while the sheet slides closed.
  const [shown, setShown] = React.useState<EntryEdit | null>(target)
  if (target && target !== shown) setShown(target)
  const schema = shown ? SCHEMAS[shown.table] : null

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
          <Pencil className="size-5 text-[#318E63]" />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the schema matches shown.table */}
          <SheetTitle className="text-lg font-semibold">{shown && schema ? (schema.title as (r: any) => string)(shown.row) : "Edit"}</SheetTitle>
          <SheetDescription className="sr-only">Change the details, or delete it.</SheetDescription>
        </div>
        {shown && <EntryForm key={`${shown.table}:${shown.row.id}`} target={shown} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function EntryForm({ target, onDone }: { target: EntryEdit; onDone: () => void }) {
  const router = useRouter()
  const schema = SCHEMAS[target.table]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the schema matches target.table
  const [values, setValues] = React.useState<Values>(() => (schema.load as (r: any) => Values)(target.row))
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const set = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    setError(null)
    setConfirmDelete(false)
  }

  // .select() so a write that row-level security quietly skipped (no error,
  // zero rows) shows up as a failure instead of looking saved.
  async function write(run: () => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const res = await run()
    setBusy(false)
    const err = res.error ?? (res.data && res.data.length === 0 ? { message: "permission: no rows changed" } : null)
    if (err) {
      // Usually a missing row-level-security policy for updates/deletes.
      if (/duplicate key|unique/i.test(err.message)) return setError("There's already one logged for that date. Edit that one instead.")
      return setError(/policy|permission|denied/i.test(err.message) ? "Supabase won't allow editing this yet. Run the edit-entries SQL, then try again." : err.message)
    }
    onDone()
    router.refresh()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const missing = schema.fields.find((f) => f.required && !values[f.key]?.trim())
    if (missing) return setError(`${missing.label} can't be empty.`)
    if (!values.date) return setError("Pick a date.")
    const out = schema.save(values)
    if (out.error || !out.row) return setError(out.error ?? "Something's off.")
    write(() => createClient().from(target.table).update(out.row!).eq("id", target.row.id).select("id"))
  }

  function remove() {
    if (!confirmDelete) return setConfirmDelete(true)
    write(() => createClient().from(target.table).delete().eq("id", target.row.id).select("id"))
  }

  // Lay out half-width fields two to a row.
  const rows: FieldDef[][] = []
  for (const f of schema.fields) {
    const last = rows[rows.length - 1]
    if (f.half && last && last.length === 1 && last[0].half) last.push(f)
    else rows.push([f])
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {rows.map((row) =>
        row.length === 2 || row[0].half ? (
          <div key={row.map((f) => f.key).join()} className="grid grid-cols-2 gap-3">
            {row.map((f) => (
              <FieldInput key={f.key} field={f} value={values[f.key] ?? ""} onChange={(v) => set(f.key, v)} />
            ))}
          </div>
        ) : (
          <FieldInput key={row[0].key} field={row[0]} value={values[row[0].key] ?? ""} onChange={(v) => set(row[0].key, v)} />
        )
      )}
      <ErrorText>{error}</ErrorText>
      <SaveButton busy={busy}>Save changes</SaveButton>
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
        {confirmDelete ? "Tap again to delete" : "Delete"}
      </button>
    </form>
  )
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  if (field.kind === "choice") {
    return (
      <FieldGroup label={field.label}>
        <Choice options={field.options ?? []} value={value || null} onChange={(v) => onChange(field.clearable && v === value ? "" : v)} />
      </FieldGroup>
    )
  }
  return (
    <Field label={field.label} hint={field.hint}>
      {field.kind === "number" ? (
        <NumberInput value={value} onChange={(e) => onChange(e.target.value)} />
      ) : field.kind === "textarea" ? (
        <TextArea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <TextInput
          type={field.kind === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.kind === "date"}
          className={field.kind === "date" ? "dark:[color-scheme:dark]" : undefined}
        />
      )}
    </Field>
  )
}
