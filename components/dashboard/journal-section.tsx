"use client"

import * as React from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  NotebookPen,
  Plus,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { JournalRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Each mood gets a color identity: a gradient bubble for the calendar, a
// solid dot for the legend, and a soft tint for the selected mood chip.
// Happy/positive skew cool & bright; stressed/angry skew red.
const MOODS = [
  { value: "happy", label: "Happy", emoji: "😊", dot: "bg-sky-500", grad: "from-sky-400 to-sky-600", soft: "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500" },
  { value: "motivated", label: "Motivated", emoji: "🔥", dot: "bg-emerald-500", grad: "from-emerald-400 to-emerald-600", soft: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500" },
  { value: "neutral", label: "Neutral", emoji: "😐", dot: "bg-zinc-400", grad: "from-zinc-300 to-zinc-500", soft: "bg-zinc-400/20 text-zinc-700 dark:text-zinc-300 ring-zinc-400" },
  { value: "tired", label: "Tired", emoji: "😴", dot: "bg-amber-500", grad: "from-amber-400 to-amber-600", soft: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500" },
  { value: "anxious", label: "Anxious", emoji: "😬", dot: "bg-orange-500", grad: "from-orange-400 to-orange-600", soft: "bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500" },
  { value: "sad", label: "Sad", emoji: "😢", dot: "bg-violet-500", grad: "from-violet-400 to-violet-600", soft: "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500" },
  { value: "stressed", label: "Stressed", emoji: "😵", dot: "bg-red-500", grad: "from-red-400 to-red-600", soft: "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500" },
  { value: "angry", label: "Angry", emoji: "😠", dot: "bg-rose-600", grad: "from-rose-500 to-rose-700", soft: "bg-rose-600/15 text-rose-700 dark:text-rose-300 ring-rose-600" },
] as const

type MoodValue = (typeof MOODS)[number]["value"]

const MOOD_BY_VALUE = new Map(MOODS.map((m) => [m.value, m]))

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]

function toKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// "Thursday, July 17, 2026" for a YYYY-MM-DD key, parsed in local time.
function longDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

type Draft = {
  id: string | null
  date: string
  title: string
  entry: string
  mood: MoodValue | null
}

function toDraft(row: JournalRow): Draft {
  return {
    id: row.id,
    date: row.date,
    title: row.title ?? "",
    entry: row.entry ?? "",
    mood: (row.mood as MoodValue | null) ?? null,
  }
}

function newDraft(date: string): Draft {
  return { id: null, date, title: "", entry: "", mood: null }
}

// Newest entry first — page 1 of the book is the most recent.
function sortEntries(rows: JournalRow[]): JournalRow[] {
  return [...rows].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
  )
}

export function JournalSection({
  entries: initialEntries,
  userId,
}: {
  entries: JournalRow[]
  userId: string
}) {
  const supabase = React.useMemo(() => createClient(), [])

  const [entries, setEntries] = React.useState<JournalRow[]>(() =>
    sortEntries(initialEntries)
  )
  const [draft, setDraft] = React.useState<Draft>(() =>
    entries.length > 0 ? toDraft(entries[0]) : newDraft(toKey(new Date()))
  )
  // Start closed on the cover when there are entries to leaf through.
  const [showCover, setShowCover] = React.useState(() => entries.length > 0)
  const [flip, setFlip] = React.useState(0) // bump to replay the page-turn
  const [flipDir, setFlipDir] = React.useState<"forward" | "back">("forward")
  const [month, setMonth] = React.useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [saving, setSaving] = React.useState(false)
  const [savedAt, setSavedAt] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Latest entry per date, for coloring the calendar (entries is already
  // newest-first, so the first one seen for a date wins).
  const entryByDate = React.useMemo(() => {
    const map = new Map<string, JournalRow>()
    for (const e of entries) if (!map.has(e.date)) map.set(e.date, e)
    return map
  }, [entries])

  // Index of the current draft within the book, or -1 for an unsaved page.
  const pos = draft.id ? entries.findIndex((e) => e.id === draft.id) : -1

  function open(next: Draft, dir: "forward" | "back" = "forward") {
    setDraft(next)
    setFlipDir(dir)
    setShowCover(false)
    setError(null)
    setSavedAt(null)
    setFlip((f) => f + 1)
  }

  function goToCover(dir: "forward" | "back") {
    setShowCover(true)
    setFlipDir(dir)
    setError(null)
    setSavedAt(null)
    setFlip((f) => f + 1)
  }

  function openDate(dateKey: string) {
    const existing = entryByDate.get(dateKey)
    open(existing ? toDraft(existing) : newDraft(dateKey))
  }

  function startNewEntry() {
    open(newDraft(toKey(new Date())))
    const now = new Date()
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  // The last-saved version of the current page, and whether the draft has
  // unsaved edits (drives Cancel and blocks page turns).
  const savedEntry = pos >= 0 ? entries[pos] : null
  const baseline = savedEntry ? toDraft(savedEntry) : newDraft(draft.date)
  const dirty =
    !showCover &&
    (draft.title !== baseline.title ||
      draft.entry !== baseline.entry ||
      draft.mood !== baseline.mood)

  // Page-turn availability. Turning is blocked while there are unsaved edits
  // so the on-page Save/Cancel flow can't be skipped by accident.
  const canTurnBack = !dirty && !showCover
  const canTurnForward =
    !dirty &&
    (showCover
      ? true
      : pos === -1
        ? entries.length > 0
        : pos < entries.length - 1)

  function turnBack() {
    if (!canTurnBack) return
    if (pos <= 0) goToCover("back")
    else open(toDraft(entries[pos - 1]), "back")
  }

  function turnForward() {
    if (!canTurnForward) return
    if (showCover) {
      open(
        entries.length > 0 ? toDraft(entries[0]) : newDraft(toKey(new Date())),
        "forward"
      )
    } else if (pos === -1) {
      open(toDraft(entries[0]), "forward")
    } else {
      open(toDraft(entries[pos + 1]), "forward")
    }
  }

  function cancel() {
    setDraft(baseline)
    setError(null)
    setSavedAt(null)
  }

  async function save() {
    if (!draft.entry.trim()) {
      setError("Write something before saving.")
      return
    }
    setSaving(true)
    setError(null)

    const fields = {
      date: draft.date,
      title: draft.title.trim() || null,
      entry: draft.entry.trim(),
      mood: draft.mood,
    }

    if (draft.id) {
      const { data, error: err } = await supabase
        .from("journal")
        .update(fields)
        .eq("id", draft.id)
        .select()
        .single()
      setSaving(false)
      if (err || !data) {
        setError(err?.message ?? "Couldn't save.")
        return
      }
      const saved = data as JournalRow
      setEntries((prev) =>
        sortEntries(prev.map((e) => (e.id === saved.id ? saved : e)))
      )
      setDraft(toDraft(saved))
    } else {
      const { data, error: err } = await supabase
        .from("journal")
        .insert({ user_id: userId, ...fields })
        .select()
        .single()
      setSaving(false)
      if (err || !data) {
        setError(err?.message ?? "Couldn't save.")
        return
      }
      const saved = data as JournalRow
      setEntries((prev) => sortEntries([saved, ...prev]))
      setDraft(toDraft(saved))
    }
    setSavedAt(Date.now())
  }

  const flipClass =
    flipDir === "forward" ? "animate-page-forward" : "animate-page-back"

  // Calendar cell math.
  const today = new Date()
  const todayKey = toKey(today)
  const monthLabel = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate()
  const leadingBlanks = month.getDay()

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:flex-row">
      {/* Journal book — the book itself is the container (no card). */}
      <div className="flex flex-col lg:h-full lg:basis-0 lg:grow-[2]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-heading text-sm font-medium text-muted-foreground">
            <NotebookPen className="size-4" />
            Journal
          </h3>
          <Button variant="outline" size="sm" onClick={startNewEntry}>
            <Plus className="size-4" />
            New entry
          </Button>
        </div>

        {/* Black hardcover. Click the left/right edges (the black margins)
            to turn pages. */}
        <div className="relative flex flex-1 items-stretch overflow-hidden rounded-xl bg-neutral-950 p-2.5 shadow-2xl">
          <button
            type="button"
            aria-label="Turn to newer page"
            title={dirty ? "Save or cancel first" : "Newer page"}
            disabled={!canTurnBack}
            onClick={turnBack}
            className="group relative flex w-9 shrink-0 items-center justify-center rounded-l-lg sm:w-12"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-3 left-2 w-px bg-white/15"
            />
            <ChevronLeft className="size-5 text-white/35 transition group-hover:text-white/85 group-disabled:opacity-0" />
          </button>

          <div className="relative flex min-w-0 flex-1">
            {/* a peek of page edges under the top page */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-l-sm rounded-r-md"
              style={{ backgroundColor: "var(--journal-paper-edge)" }}
            />

            {showCover ? (
              <div
                key={`cover-${flip}`}
                className={cn(
                  "relative flex min-h-[24rem] w-full flex-1 flex-col items-center justify-center rounded-l-sm rounded-r-md p-8 text-center shadow-md",
                  flipClass
                )}
                style={{ backgroundColor: "#14110d", color: "#ecdfc4" }}
              >
                <div className="pointer-events-none absolute inset-4 rounded-md border border-amber-200/25" />
                <div className="pointer-events-none absolute inset-[1.35rem] rounded-md border border-amber-200/10" />
                <NotebookPen className="mb-5 size-9 text-amber-200/55" />
                <p className="flex items-center gap-1 font-serif text-xs text-amber-200/40">
                  Tap the right edge to open
                  <ChevronRight className="size-3.5" />
                </p>
              </div>
            ) : (
              <div
                key={`${draft.id ?? "new"}-${draft.date}-${flip}`}
                className={cn(
                  "relative flex min-h-[24rem] w-full flex-1 flex-col overflow-hidden rounded-l-sm rounded-r-md py-6 pr-5 pl-8 shadow-md sm:py-8 sm:pr-7 sm:pl-10",
                  flipClass
                )}
                style={{
                  backgroundColor: "var(--journal-paper)",
                  color: "var(--journal-ink)",
                }}
              >
                {/* red margin rule near the spine */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-6 w-px sm:left-8"
                  style={{ backgroundColor: "var(--journal-margin)" }}
                />

                <div className="mb-4 flex items-baseline justify-between gap-2">
                  <p className="font-serif text-sm italic opacity-80">
                    {longDate(draft.date)}
                  </p>
                  {pos >= 0 ? (
                    <span className="font-serif text-xs tabular-nums opacity-60">
                      Entry {pos + 1} of {entries.length}
                    </span>
                  ) : (
                    <span className="font-serif text-xs italic opacity-70">
                      New page
                    </span>
                  )}
                </div>

                <input
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  placeholder="Title…"
                  aria-label="Entry title"
                  className="mb-2 w-full border-0 bg-transparent font-serif text-2xl font-semibold outline-none placeholder:opacity-40"
                  style={{ color: "var(--journal-ink)" }}
                />

                <textarea
                  value={draft.entry}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, entry: e.target.value }))
                  }
                  placeholder="Dear journal…"
                  aria-label="Journal entry"
                  className="min-h-[10rem] w-full flex-1 resize-none border-0 bg-transparent font-serif text-[17px] outline-none placeholder:opacity-40"
                  style={{
                    color: "var(--journal-ink)",
                    lineHeight: "32px",
                    backgroundImage:
                      "repeating-linear-gradient(var(--journal-paper) 0px, var(--journal-paper) 31px, var(--journal-line) 31px, var(--journal-line) 32px)",
                  }}
                />

                <div className="mt-4">
                  <p className="mb-2 font-serif text-xs italic opacity-70">
                    Today I felt…
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MOODS.map((m) => {
                      const active = draft.mood === m.value
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              mood: active ? null : m.value,
                            }))
                          }
                          aria-pressed={active}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors",
                            active
                              ? cn(m.soft, "border-transparent ring-2")
                              : "opacity-70 hover:opacity-100"
                          )}
                          style={
                            active
                              ? undefined
                              : { borderColor: "var(--journal-margin)" }
                          }
                        >
                          <span>{m.emoji}</span>
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* on-page controls: cancel + save */}
                <div
                  className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t pt-4"
                  style={{ borderColor: "var(--journal-line)" }}
                >
                  {dirty ? (
                    <span className="mr-auto font-serif text-xs italic opacity-60">
                      Unsaved changes
                    </span>
                  ) : savedAt ? (
                    <span className="mr-auto flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3.5" />
                      Saved
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancel}
                    disabled={!dirty || saving}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={save} disabled={saving || !dirty}>
                    {saving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Turn to older page"
            title={dirty ? "Save or cancel first" : "Older page"}
            disabled={!canTurnForward}
            onClick={turnForward}
            className="group relative flex w-9 shrink-0 items-center justify-center rounded-r-lg sm:w-12"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-3 right-2 w-px bg-white/15"
            />
            <ChevronRight className="size-5 text-white/35 transition group-hover:text-white/85 group-disabled:opacity-0" />
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* Mood map — narrow bubble calendar on the right */}
      <Card className="flex flex-col lg:h-full lg:basis-0 lg:grow">
        <CardHeader>
          <CardTitle className="text-base">Mood map</CardTitle>
          <CardDescription className="text-xs">
            Days you journaled, by mood.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() =>
                setMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium tabular-nums">
              {monthLabel}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next month"
              onClick={() =>
                setMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex flex-1 items-center py-2">
            <div className="grid w-full grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((d, i) => (
              <span
                key={i}
                className="text-[10px] font-semibold text-muted-foreground/70"
              >
                {d}
              </span>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const date = new Date(
                month.getFullYear(),
                month.getMonth(),
                i + 1
              )
              const key = toKey(date)
              const entry = entryByDate.get(key)
              const mood = entry?.mood
                ? MOOD_BY_VALUE.get(entry.mood as MoodValue)
                : null
              const isToday = key === todayKey
              const isFuture = key > todayKey
              const isSelected = !showCover && key === draft.date
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isFuture}
                  onClick={() => openDate(key)}
                  aria-label={`${longDate(key)}${entry?.mood ? ` · ${entry.mood}` : ""}`}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-full text-[11px] tabular-nums transition-transform",
                    mood
                      ? cn(
                          "bg-gradient-to-br text-white shadow-sm hover:scale-110",
                          mood.grad
                        )
                      : isFuture
                        ? "text-muted-foreground/25"
                        : "bg-muted/60 text-muted-foreground hover:scale-110 hover:bg-muted",
                    isSelected &&
                      "ring-2 ring-ring ring-offset-2 ring-offset-background",
                    isToday &&
                      !isSelected &&
                      "ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
                  )}
                >
                  {i + 1}
                </button>
              )
            })}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap gap-1.5 border-t pt-3">
            {MOODS.map((m) => (
              <span
                key={m.value}
                className="flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                <span className={cn("size-2 rounded-full", m.dot)} />
                {m.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
