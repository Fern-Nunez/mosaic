// Date math shared by the /app server pages and client components.
// Dates are "YYYY-MM-DD" keys in the phone's local calendar, matching how
// every table stores its `date` column.

export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Noon on that day, so time-zone shifts never land on the wrong date. */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d, 12)
}

export function shiftKey(key: string, days: number): string {
  const d = keyToDate(key)
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

export function shortLabel(key: string): string {
  return keyToDate(key).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * Calendar periods: today, this month, this quarter, this year. Each is
 * compared with the same stretch of the period before (Oct 1–25 vs Sep 1–25).
 */
export const RANGES = [
  { id: "d", label: "D", title: "Today", compare: "yesterday" },
  { id: "m", label: "M", title: "This month", compare: "this time last month" },
  { id: "q", label: "Q", title: "This quarter", compare: "this time last quarter" },
  { id: "y", label: "Y", title: "This year", compare: "this time last year" },
] as const

export type Range = (typeof RANGES)[number]
export type RangeId = Range["id"]

export function parseRange(value: string | string[] | undefined): Range {
  const id = Array.isArray(value) ? value[0] : value
  return RANGES.find((r) => r.id === id) ?? RANGES[1]
}

const firstOfMonth = (y: number, m: number) => dateKey(new Date(y, m, 1, 12))
const lastOfMonth = (y: number, m: number) => dateKey(new Date(y, m + 1, 0, 12))

/** First day of the period containing `key`. */
export function periodStart(key: string, id: RangeId): string {
  const d = keyToDate(key)
  if (id === "d") return key
  if (id === "m") return firstOfMonth(d.getFullYear(), d.getMonth())
  if (id === "q") return firstOfMonth(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3)
  return firstOfMonth(d.getFullYear(), 0)
}

/** Start and last day of the period before the one containing `key`. */
function previousPeriod(key: string, id: RangeId): { start: string; last: string } {
  const d = keyToDate(key)
  if (id === "d") return { start: shiftKey(key, -1), last: shiftKey(key, -1) }
  if (id === "m") return { start: firstOfMonth(d.getFullYear(), d.getMonth() - 1), last: lastOfMonth(d.getFullYear(), d.getMonth() - 1) }
  if (id === "q") {
    const q = Math.floor(d.getMonth() / 3) * 3
    return { start: firstOfMonth(d.getFullYear(), q - 3), last: lastOfMonth(d.getFullYear(), q - 1) }
  }
  return { start: firstOfMonth(d.getFullYear() - 1, 0), last: lastOfMonth(d.getFullYear() - 1, 11) }
}

export function daysBetween(start: string, end: string): number {
  return Math.round((keyToDate(end).getTime() - keyToDate(start).getTime()) / 86_400_000) + 1
}

/** The current period so far, and the same number of days at the start of the last one. */
export function windowStarts(today: string, id: RangeId) {
  const start = periodStart(today, id)
  const elapsed = daysBetween(start, today)
  const prev = previousPeriod(today, id)
  const prevEnd = shiftKey(prev.start, elapsed - 1)
  return { start, days: elapsed, prevStart: prev.start, prevEnd: prevEnd > prev.last ? prev.last : prevEnd }
}

/** Earliest date the Trends pages need for a period (start of the previous one). */
export function earliestNeeded(today: string, id: RangeId): string {
  return previousPeriod(today, id).start
}

export type Bucket = { start: string; end: string; label: string }

/**
 * Chart columns for the period so far: one for today, days for the month,
 * weeks for the quarter, months for the year.
 */
export function buildBuckets(today: string, id: RangeId): Bucket[] {
  const start = periodStart(today, id)
  if (id === "d") return [{ start: today, end: today, label: "Today" }]
  if (id === "m") {
    return Array.from({ length: daysBetween(start, today) }, (_, i) => {
      const key = shiftKey(start, i)
      return { start: key, end: key, label: shortLabel(key) }
    })
  }
  if (id === "q") {
    const weeks = Math.ceil(daysBetween(start, today) / 7)
    return Array.from({ length: weeks }, (_, i) => {
      const s = shiftKey(start, i * 7)
      const e = shiftKey(s, 6)
      return { start: s, end: e > today ? today : e, label: shortLabel(s) }
    })
  }
  const t = keyToDate(today)
  return Array.from({ length: t.getMonth() + 1 }, (_, i) => ({
    start: firstOfMonth(t.getFullYear(), i),
    end: i === t.getMonth() ? today : lastOfMonth(t.getFullYear(), i),
    label: new Date(t.getFullYear(), i, 1, 12).toLocaleDateString("en-US", { month: "short" }),
  }))
}

export function inRange(key: string, start: string, end: string) {
  return key >= start && key <= end
}

export type Month = { year: number; month: number; label: string }

/** Calendar months from `start` through `end`, oldest first. */
export function monthsBetween(start: string, end: string): Month[] {
  const last = keyToDate(end)
  const months: Month[] = []
  const cursor = keyToDate(start)
  cursor.setDate(1)
  while (cursor <= last) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth(), label: "" })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const long = months.length <= 4
  return months.map((m) => ({
    ...m,
    label: new Date(m.year, m.month, 1, 12).toLocaleDateString("en-US", { month: long ? "long" : "short" }),
  }))
}
