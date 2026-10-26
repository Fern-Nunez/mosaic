import {
  BookOpen,
  CircleCheck,
  Dumbbell,
  Moon,
  Pill,
  Scale,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import type { TrendCategory } from "@/lib/app/trend-data"

/** Label, icon and color for each category, used the same way everywhere. */
export const CATEGORY_META: Record<
  TrendCategory,
  { label: string; title: string; icon: LucideIcon; color: string }
> = {
  money: { label: "Money", title: "Money", icon: Wallet, color: "#4E8A6B" },
  nutrition: { label: "Nutrition", title: "Nutrition", icon: Utensils, color: "#C9A24A" },
  workout: { label: "Workout", title: "Workouts", icon: Dumbbell, color: "#6A7FB8" },
  weight: { label: "Weight", title: "Weight", icon: Scale, color: "#5A9E9A" },
  sleep: { label: "Sleep", title: "Sleep", icon: Moon, color: "#8A7BB8" },
  journal: { label: "Journal", title: "Journal", icon: BookOpen, color: "#C8735F" },
  habits: { label: "Habits", title: "Habits", icon: CircleCheck, color: "#8AA36A" },
  supplements: { label: "Supplements", title: "Supplements", icon: Pill, color: "#C27A98" },
}
