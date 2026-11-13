import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { DEFAULT_WORKOUT_REMINDER_TIME, readPrefs, supplementDue, workoutPlan, type WorkoutKind } from "@/lib/app/prefs"

/* What the daily reminder says, and whether it should go out at all. */

export type Reminder =
  | { send: false; reason: string }
  | { send: true; reason: string; title: string; body: string; url: string; tag: string }

type Quote = { text: string; by: string; kinds?: WorkoutKind[] }

// Short, real, correctly attributed. Kind-specific ones are picked first on
// matching days.
const QUOTES: Quote[] = [
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", by: "Will Durant" },
  { text: "You miss 100% of the shots you don't take.", by: "Wayne Gretzky" },
  { text: "Hard work beats talent when talent doesn't work hard.", by: "Tim Notke" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", by: "Jim Ryun" },
  { text: "Make each day your masterpiece.", by: "John Wooden" },
  { text: "Don't let what you cannot do interfere with what you can do.", by: "John Wooden" },
  { text: "Champions keep playing until they get it right.", by: "Billie Jean King" },
  { text: "I've failed over and over and over again in my life. And that is why I succeed.", by: "Michael Jordan" },
  { text: "Don't count the days, make the days count.", by: "Muhammad Ali" },
  {
    text: "If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but whatever you do you have to keep moving forward.",
    by: "Martin Luther King Jr.",
  },
  { text: "The last three or four reps is what makes the muscle grow.", by: "Arnold Schwarzenegger", kinds: ["lift"] },
  { text: "Ain't nothin' but a peanut.", by: "Ronnie Coleman", kinds: ["lift"] },
  { text: "The miracle isn't that I finished. The miracle is that I had the courage to start.", by: "John Bingham", kinds: ["run"] },
  { text: "Run when you can, walk if you have to, crawl if you must; just never give up.", by: "Dean Karnazes", kinds: ["run"] },
  { text: "Life is like riding a bicycle. To keep your balance you must keep moving.", by: "Albert Einstein", kinds: ["bike"] },
  { text: "Just keep swimming.", by: "Dory, Finding Nemo", kinds: ["swim"] },
]

const PHRASE: Record<WorkoutKind, string> = { lift: "lift", run: "run", bike: "bike ride", swim: "swim", walk: "walk", hike: "hike" }

/** Same quote all day (so a check and the real send match), new one tomorrow. */
function pickQuote(day: string, kinds: WorkoutKind[]) {
  const matching = QUOTES.filter((q) => q.kinds?.some((k) => kinds.includes(k)))
  // Never a running quote on a swim day: other days get the general ones.
  const general = QUOTES.filter((q) => !q.kinds)
  const pool = matching.length && Number(day.slice(-2)) % 2 === 0 ? matching : general
  const seed = [...day].reduce((n, c) => n * 31 + c.charCodeAt(0), 7)
  return pool[Math.abs(seed) % pool.length]
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const joinAnd = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`

/** "2026-10-25" in the given time zone. */
export function todayIn(timeZone: string, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
  }
}

/**
 * "Pay your bills" on the day of the month picked in More. A day past the
 * end of a short month (31 in November) fires on that month's last day.
 * Lists the cards with a payment due before the next bill day.
 */
export async function billReminder(supabase: SupabaseClient, userId: string, day: string): Promise<Reminder> {
  const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle()
  const payDay = readPrefs(settings?.app_prefs).billPayDay
  if (!payDay) return { send: false, reason: "No bill day set." }

  const [y, m, d] = day.split("-").map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  if (d !== Math.min(payDay, lastDay)) return { send: false, reason: `Bill day is day ${payDay} of the month, not today.` }

  // Cards repeat monthly on the day of their saved due date; find each one's
  // next due date from today and keep the ones due within a month.
  const { data: accounts } = await supabase
    .from("accounts")
    .select("name, payment_due_date")
    .eq("user_id", userId)
    .not("payment_due_date", "is", null)
  const today = new Date(y, m - 1, d, 12)
  const due = (accounts ?? [])
    .map((a: { name: string; payment_due_date: string }) => {
      const dueDay = Number(a.payment_due_date.split("-")[2])
      let next = new Date(y, m - 1, Math.min(dueDay, lastDay), 12)
      if (next < today) {
        const nextLast = new Date(y, m + 1, 0).getDate()
        next = new Date(y, m, Math.min(dueDay, nextLast), 12)
      }
      return { name: a.name, next }
    })
    .sort((a, b) => a.next.getTime() - b.next.getTime())
  const label = (dt: Date) => dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return {
    send: true,
    reason: "Today is your bill day.",
    title: "Time to pay your bills",
    body: due.length ? joinAnd(due.map((a) => `${a.name} (due ${label(a.next)})`)) : "Your monthly bill day. Check your cards and accounts.",
    url: "/app/trends/money",
    tag: `bills-${day}`,
  }
}

/**
 * Checks today's workout plan against what's been logged. Works with the
 * signed-in client (row level security limits it to you) or the admin one.
 * Pass `minutes` (local time now) from the 15-minute job so it only fires
 * in the slot holding your reminder time; the test buttons leave it out.
 */
export async function workoutReminder(supabase: SupabaseClient, userId: string, day: string, minutes?: number): Promise<Reminder> {
  const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle()
  const prefs = readPrefs(settings?.app_prefs)
  if (prefs.hiddenSections?.includes("workout")) return { send: false, reason: "Workout section is turned off." }
  if (prefs.workoutReminder === false) return { send: false, reason: "Workout reminder is turned off." }
  const time = prefs.workoutReminderTime ?? DEFAULT_WORKOUT_REMINDER_TIME
  if (minutes !== undefined && !inSlot(time, minutes)) return { send: false, reason: `Set for ${time}, not this slot.` }

  const plan = workoutPlan(prefs)
  if (!plan) return { send: false, reason: "No workout plan set. Add one in Workout settings." }

  const [y, m, d] = day.split("-").map(Number)
  const weekday = new Date(y, m - 1, d, 12).getDay()
  const planned = plan[weekday]
  if (!planned.length) return { send: false, reason: "Rest day. Nothing planned." }

  // Logged in any dashboard counts.
  const [lifts, runs, cardio] = await Promise.all([
    supabase.from("gym_weight").select("id").eq("user_id", userId).eq("date", day).limit(1),
    supabase.from("runs").select("id").eq("user_id", userId).eq("date", day).limit(1),
    // Missing until the cardio SQL is run; then it just comes back empty.
    supabase.from("cardio").select("activity").eq("user_id", userId).eq("date", day),
  ])
  const done = new Set<WorkoutKind>()
  if (lifts.data?.length) done.add("lift")
  if (runs.data?.length) done.add("run")
  for (const c of (cardio.data ?? []) as { activity: WorkoutKind }[]) done.add(c.activity)

  const left = planned.filter((k) => !done.has(k))
  if (!left.length) return { send: false, reason: "Already logged today's workout. Nice." }

  const quote = pickQuote(day, left)
  return {
    send: true,
    reason: `${cap(joinAnd(left.map((k) => PHRASE[k])))} planned and not logged yet.`,
    title: `Don't forget your ${joinAnd(left.map((k) => PHRASE[k]))} today`,
    body: `"${quote.text}" (${quote.by})`,
    url: "/app/trends/workout",
    tag: `workout-${day}`,
  }
}

/** Minutes past midnight right now in the given time zone. */
export function minutesIn(timeZone: string, now = new Date()) {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now)
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = fmt(timeZone)
  } catch {
    parts = fmt("America/Los_Angeles")
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return get("hour") * 60 + get("minute")
}

/** How often the timed-reminder job runs; a reminder fires in the slot its time falls in. */
export const SLOT_MINUTES = 15

/** True when "HH:MM" falls in the 15-minute slot that `minutes` is in. */
function inSlot(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number)
  const at = h * 60 + m
  const slot = Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES
  return at >= slot && at < slot + SLOT_MINUTES
}

/**
 * "Time to journal" at the time picked in More, unless you've already
 * written today. The job runs every 15 minutes; this fires once, in the
 * run whose 15-minute slot holds your time.
 */
export async function journalReminder(supabase: SupabaseClient, userId: string, day: string, minutes: number): Promise<Reminder> {
  const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle()
  const prefs = readPrefs(settings?.app_prefs)
  const time = prefs.journalReminderTime
  if (!time) return { send: false, reason: "No journal reminder time set." }
  if (prefs.hiddenSections?.includes("journal")) return { send: false, reason: "Journal section is turned off." }

  if (!inSlot(time, minutes)) return { send: false, reason: `Set for ${time}, not this slot.` }

  const { data: entries } = await supabase.from("journal").select("id").eq("user_id", userId).eq("date", day).limit(1)
  if (entries?.length) return { send: false, reason: "Already wrote today." }

  return {
    send: true,
    reason: `Journal reminder at ${time}.`,
    title: "Time to journal",
    body: "A few lines about today. How did it go?",
    url: "/app/trends/journal",
    tag: `journal-${day}`,
  }
}

/**
 * Supplements due today (by each one's weekday schedule) that haven't been
 * logged yet, at the time picked in More.
 */
export async function supplementReminder(supabase: SupabaseClient, userId: string, day: string, minutes: number): Promise<Reminder> {
  const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle()
  const prefs = readPrefs(settings?.app_prefs)
  const time = prefs.supplementReminderTime
  if (!time) return { send: false, reason: "No supplement reminder time set." }
  if (prefs.hiddenSections?.includes("supplements")) return { send: false, reason: "Supplements section is turned off." }
  if (!inSlot(time, minutes)) return { send: false, reason: `Set for ${time}, not this slot.` }

  const [stack, logs] = await Promise.all([
    supabase.from("supplements").select("id, name").eq("user_id", userId).eq("is_active", true).order("position", { ascending: true }),
    supabase.from("supplement_logs").select("name").eq("user_id", userId).eq("date", day),
  ])
  if (stack.error) return { send: false, reason: "Supplements aren't set up yet." }
  const taken = new Set((logs.data ?? []).map((l: { name: string }) => l.name))
  const left = (stack.data ?? [])
    .filter((s: { id: string; name: string }) => supplementDue(prefs, s.id, day) && !taken.has(s.name))
    .map((s: { name: string }) => s.name)
  if (!left.length) return { send: false, reason: "Nothing due, or all taken." }

  return {
    send: true,
    reason: `${left.length} not taken yet.`,
    title: "Time for your supplements",
    body: joinAnd(left),
    url: "/app/trends/supplements",
    tag: `supplements-${day}`,
  }
}

/** A weigh-in nudge at the time picked in More, unless you've weighed in today. */
export async function weightReminder(supabase: SupabaseClient, userId: string, day: string, minutes: number): Promise<Reminder> {
  const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle()
  const prefs = readPrefs(settings?.app_prefs)
  const time = prefs.weightReminderTime
  if (!time) return { send: false, reason: "No weight reminder time set." }
  if (prefs.hiddenSections?.includes("weight")) return { send: false, reason: "Weight section is turned off." }
  if (!inSlot(time, minutes)) return { send: false, reason: `Set for ${time}, not this slot.` }

  const { data } = await supabase.from("personal_weight").select("id").eq("user_id", userId).eq("date", day).not("weight", "is", null).limit(1)
  if (data?.length) return { send: false, reason: "Already weighed in today." }

  return {
    send: true,
    reason: `Weight reminder at ${time}.`,
    title: "Time to weigh in",
    body: "Step on the scale and log it.",
    url: "/app/trends/weight",
    tag: `weight-${day}`,
  }
}
