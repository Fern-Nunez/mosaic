// Daily habits ("dopamine dots") — the tappable icons in the top bar.
// Each tap records a habit_completions row in Supabase, scoped per
// dashboard (workspace).

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

