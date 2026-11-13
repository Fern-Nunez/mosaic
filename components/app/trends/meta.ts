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
  money: { label: "Money", title: "Money", icon: Wallet, color: "#2FA36B" },
  nutrition: { label: "Nutrition", title: "Nutrition", icon: Utensils, color: "#F2B33D" },
  workout: { label: "Workout", title: "Workouts", icon: Dumbbell, color: "#4F7CF0" },
  weight: { label: "Weight", title: "Weight", icon: Scale, color: "#22B3A6" },
  sleep: { label: "Sleep", title: "Sleep", icon: Moon, color: "#8B6CF0" },
  journal: { label: "Journal", title: "Journal", icon: BookOpen, color: "#EE6C4D" },
  habits: { label: "Habits", title: "Habits", icon: CircleCheck, color: "#7CC447" },
  supplements: { label: "Supplements", title: "Supplements", icon: Pill, color: "#E2609A" },
}
