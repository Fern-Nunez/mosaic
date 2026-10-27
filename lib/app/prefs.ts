// Per-user app settings, stored as one JSON object on
// user_settings.app_prefs (see the app_prefs migration).

export type WorkoutKind = "lift" | "run" | "bike" | "swim" | "walk" | "hike"

export const WORKOUT_KINDS: { id: WorkoutKind; label: string; noun: string }[] = [
  { id: "lift", label: "Lift", noun: "Lift" },
  { id: "run", label: "Run", noun: "Run" },
  { id: "bike", label: "Bike", noun: "Bike ride" },
  { id: "swim", label: "Swim", noun: "Swim" },
  { id: "walk", label: "Walk", noun: "Walk" },
  { id: "hike", label: "Hike", noun: "Hike" },
]

/** Sections that can be switched off in More → Sections. */
export type SectionId =
  | "money"
  | "nutrition"
  | "workout"
  | "weight"
  | "sleep"
  | "journal"
  | "habits"
  | "supplements"

export type AppPrefs = {
  /** Monthly spending budget in dollars. */
  moneyBudget?: number | null
  /** Old weekly goal (1–7). The workout plan replaces it once one is saved. */
  workoutDaysPerWeek?: number | null
  /** What you plan to do each weekday. Index 0 is Sunday; [] is a rest day. */
  workoutPlan?: WorkoutKind[][] | null
  /** Goal body weight, in your usual unit. */
  weightGoal?: number | null
  /** Hours of sleep you aim for each night. */
  sleepGoalHours?: number | null
  /** Hide journal entry text in lists (titles and moods still show). */
  journalHideText?: boolean
  /** Sections turned off in More. */
  hiddenSections?: SectionId[]
  /**
   * Weekdays each supplement is taken, by supplement id (0 = Sunday).
   * Missing or all 7 = every day.
   */
  supplementDays?: Record<string, number[]>
}

export const DEFAULT_SLEEP_GOAL = 7

export function readPrefs(value: unknown): AppPrefs {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AppPrefs) : {}
}

export function isSectionOn(prefs: AppPrefs, id: SectionId) {
  return !prefs.hiddenSections?.includes(id)
}

/** Weekdays a supplement is taken, or null for every day. */
export function supplementSchedule(prefs: AppPrefs, id: string): number[] | null {
  const days = prefs.supplementDays?.[id]
  return Array.isArray(days) && days.length > 0 && days.length < 7 ? days : null
}

/** Is this supplement scheduled on the given "YYYY-MM-DD" day? */
export function supplementDue(prefs: AppPrefs, id: string, day: string) {
  const days = supplementSchedule(prefs, id)
  if (!days) return true
  const [y, m, d] = day.split("-").map(Number)
  return days.includes(new Date(y, m - 1, d, 12).getDay())
}

/** The saved plan, or null when there isn't one (or every day is rest). */
export function workoutPlan(prefs: AppPrefs): WorkoutKind[][] | null {
  const plan = prefs.workoutPlan
  if (!Array.isArray(plan) || plan.length !== 7) return null
  const clean = plan.map((day) => (Array.isArray(day) ? day.filter((k) => WORKOUT_KINDS.some((w) => w.id === k)) : []))
  return clean.some((day) => day.length) ? clean : null
}

/** Workout days a week you're aiming for: from the plan, else the old number. */
export function weeklyWorkoutGoal(prefs: AppPrefs): number | null {
  const plan = workoutPlan(prefs)
  if (plan) return plan.filter((day) => day.length).length
  return prefs.workoutDaysPerWeek ?? null
}

/** "Lift + Run", "Swim", or null for a rest day. */
export function planLabel(kinds: WorkoutKind[]) {
  if (!kinds.length) return null
  return kinds.map((k) => WORKOUT_KINDS.find((w) => w.id === k)!.noun).join(" + ")
}
