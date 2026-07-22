// Daily habits ("dopamine dots") live in localStorage, per dashboard,
// alongside the check-in calendar. When every habit is completed on a
// given day we mark that day in the shared check-in set so the overview
// calendar shows a green check — the two features stay in sync in-tab
// through the mosaic:local-storage event (see use-local-storage).

import {
  Activity,
  AlarmClock,
  Apple,
  Bath,
  Bed,
  Bell,
  Bike,
  Book,
  BookOpen,
  Brain,
  Briefcase,
  Camera,
  Carrot,
  ChefHat,
  Clock,
  Code,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Dog,
  Droplet,
  Dumbbell,
  Feather,
  Flame,
  Flower2,
  Footprints,
  Gamepad2,
  GraduationCap,
  Guitar,
  Headphones,
  Heart,
  HeartHandshake,
  House,
  Leaf,
  Lightbulb,
  ListTodo,
  MapPin,
  Medal,
  Moon,
  Mountain,
  Music,
  Notebook,
  Paintbrush,
  Palette,
  PenLine,
  PiggyBank,
  Pill,
  Rocket,
  Salad,
  ShowerHead,
  Smile,
  Sparkles,
  Sprout,
  Star,
  Stethoscope,
  Sun,
  Target,
  Timer,
  TreePine,
  Trophy,
  Utensils,
  Waves,
  Wind,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react"

export type Habit = {
  id: string
  name: string
  /** Key into HABIT_ICONS; falls back to the first icon if unknown. */
  icon: string
}

// A curated set to pick from when adding a habit. Keys are stored, so
// don't rename an existing one — add new entries to the end instead.
export const HABIT_ICONS: { key: string; icon: LucideIcon }[] = [
  { key: "droplet", icon: Droplet },
  { key: "cupsoda", icon: CupSoda },
  { key: "coffee", icon: Coffee },
  { key: "wine", icon: Wine },
  { key: "dumbbell", icon: Dumbbell },
  { key: "bike", icon: Bike },
  { key: "footprints", icon: Footprints },
  { key: "activity", icon: Activity },
  { key: "mountain", icon: Mountain },
  { key: "waves", icon: Waves },
  { key: "book", icon: BookOpen },
  { key: "book-closed", icon: Book },
  { key: "notebook", icon: Notebook },
  { key: "pen", icon: PenLine },
  { key: "graduation", icon: GraduationCap },
  { key: "lightbulb", icon: Lightbulb },
  { key: "code", icon: Code },
  { key: "briefcase", icon: Briefcase },
  { key: "listtodo", icon: ListTodo },
  { key: "apple", icon: Apple },
  { key: "carrot", icon: Carrot },
  { key: "salad", icon: Salad },
  { key: "chefhat", icon: ChefHat },
  { key: "utensils", icon: Utensils },
  { key: "croissant", icon: Croissant },
  { key: "cookie", icon: Cookie },
  { key: "moon", icon: Moon },
  { key: "bed", icon: Bed },
  { key: "sun", icon: Sun },
  { key: "alarm", icon: AlarmClock },
  { key: "clock", icon: Clock },
  { key: "timer", icon: Timer },
  { key: "bell", icon: Bell },
  { key: "brain", icon: Brain },
  { key: "heart", icon: Heart },
  { key: "handshake-heart", icon: HeartHandshake },
  { key: "smile", icon: Smile },
  { key: "pill", icon: Pill },
  { key: "stethoscope", icon: Stethoscope },
  { key: "bath", icon: Bath },
  { key: "shower", icon: ShowerHead },
  { key: "leaf", icon: Leaf },
  { key: "sprout", icon: Sprout },
  { key: "flower", icon: Flower2 },
  { key: "tree", icon: TreePine },
  { key: "flame", icon: Flame },
  { key: "wind", icon: Wind },
  { key: "music", icon: Music },
  { key: "headphones", icon: Headphones },
  { key: "guitar", icon: Guitar },
  { key: "paintbrush", icon: Paintbrush },
  { key: "palette", icon: Palette },
  { key: "camera", icon: Camera },
  { key: "feather", icon: Feather },
  { key: "gamepad", icon: Gamepad2 },
  { key: "dog", icon: Dog },
  { key: "house", icon: House },
  { key: "mappin", icon: MapPin },
  { key: "piggybank", icon: PiggyBank },
  { key: "target", icon: Target },
  { key: "medal", icon: Medal },
  { key: "trophy", icon: Trophy },
  { key: "star", icon: Star },
  { key: "rocket", icon: Rocket },
  { key: "sparkles", icon: Sparkles },
  { key: "zap", icon: Zap },
]

export function habitIcon(key: string): LucideIcon {
  return HABIT_ICONS.find((entry) => entry.key === key)?.icon ?? HABIT_ICONS[0].icon
}

/** One habit completed on one day (mirrors the habit_completions row). */
export type Completion = { habitId: string; date: string }

/** A saved Google Calendar embed, with a friendly name to identify it. */
export type Calendar = { name: string; url: string }

export function normalizeCalendars(value: unknown): Calendar[] {
  if (!Array.isArray(value)) return []
  const out: Calendar[] = []
  for (const item of value) {
    if (typeof item === "string") {
      out.push({ name: "Calendar", url: item })
    } else if (
      item &&
      typeof item === "object" &&
      typeof (item as { url?: unknown }).url === "string"
    ) {
      const obj = item as { name?: unknown; url: string }
      out.push({
        name: typeof obj.name === "string" ? obj.name : "Calendar",
        url: obj.url,
      })
    }
  }
  return out
}

export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Habit ids completed on a given day. */
export function completedOn(
  completions: Completion[],
  day: string
): Set<string> {
  return new Set(
    completions.filter((c) => c.date === day).map((c) => c.habitId)
  )
}

/** Days on which every current habit was completed. */
export function fullyCompletedDays(
  habits: Habit[],
  completions: Completion[]
): Set<string> {
  if (habits.length === 0) return new Set()
  const byDate = new Map<string, Set<string>>()
  for (const c of completions) {
    let set = byDate.get(c.date)
    if (!set) {
      set = new Set()
      byDate.set(c.date, set)
    }
    set.add(c.habitId)
  }
  const done = new Set<string>()
  byDate.forEach((ids, date) => {
    if (habits.every((habit) => ids.has(habit.id))) done.add(date)
  })
  return done
}

/** Consecutive fully-completed days ending today (or yesterday if today
 * isn't done yet — so an unfinished today doesn't zero out the streak). */
export function currentStreak(checked: Set<string>): number {
  const cursor = new Date()
  if (!checked.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  let streak = 0
  while (checked.has(dateKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
