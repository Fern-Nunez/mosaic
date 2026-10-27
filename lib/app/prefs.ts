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
}

export const DEFAULT_SLEEP_GOAL = 7

export function readPrefs(value: unknown): AppPrefs {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AppPrefs) : {}
}

export function isSectionOn(prefs: AppPrefs, id: SectionId) {
  return !prefs.hiddenSections?.includes(id)
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
