import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { readPrefs, workoutPlan, type WorkoutKind } from "@/lib/app/prefs"

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

const PHRASE: Record<WorkoutKind, string> = { lift: "lift", run: "run", bike: "bike ride", swim: "swim" }

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
 * Checks today's workout plan against what's been logged. Works with the
 * signed-in client (row level security limits it to you) or the admin one.
 */
export async function workoutReminder(supabase: SupabaseClient, userId: string, day: string): Promise<Reminder> {
  const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle()
  const prefs = readPrefs(settings?.app_prefs)
  if (prefs.hiddenSections?.includes("workout")) return { send: false, reason: "Workout section is turned off." }

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
