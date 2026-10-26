import {
  BookOpen,
  Dumbbell,
  ListTodo,
  Moon,
  NotebookPen,
  Pill,
  Scale,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export type LoggerId =
  | "money"
  | "workout"
  | "journal"
  | "sleep"
  | "weight"
  | "notes"
  | "nutrition"
  | "supplement"
  | "task"

export type QuickAction = {
  id: LoggerId
  label: string
  /** Title at the top of the logging sheet. */
  title: string
  icon: LucideIcon
}

// Order matches the Figma grid: left to right, top to bottom.
export const QUICK_ACTIONS: QuickAction[] = [
  { id: "money", label: "Money", title: "Log money", icon: Wallet },
  { id: "workout", label: "Workout", title: "Log a workout", icon: Dumbbell },
  { id: "journal", label: "Journal", title: "New journal entry", icon: BookOpen },
  { id: "sleep", label: "Sleep", title: "Log sleep", icon: Moon },
  { id: "weight", label: "Weight", title: "Log a weigh-in", icon: Scale },
  { id: "notes", label: "Notes", title: "Notes", icon: NotebookPen },
  { id: "nutrition", label: "Nutrition", title: "Log a meal", icon: Utensils },
  { id: "supplement", label: "Supplement", title: "Log a supplement", icon: Pill },
  { id: "task", label: "Task", title: "Tasks", icon: ListTodo },
]
