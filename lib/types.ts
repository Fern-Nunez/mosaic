export type TransactionRow = {
  id: string
  date: string
  amount: number
  category: string | null
  transaction_type: "income" | "expense"
  payment_method: string | null
  description: string | null
  account_id: string | null
}

export type AccountType =
  | "credit_card"
  | "checking"
  | "savings"
  | "debit"
  | "cash"
  | "investment"

export type AccountRow = {
  id: string
  name: string
  account_type: AccountType
  institution: string | null
  last_four: string | null
  credit_limit: number | null
  credit_used: number
  payment_due_date: string | null
  notes: string | null
}

export type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly"

export type SubscriptionRow = {
  id: string
  name: string
  amount: number
  billing_cycle: BillingCycle
  category: string | null
  account_id: string | null
  due_date: string | null
  is_active: boolean
  notes: string | null
}

export type NutritionRow = {
  id: string
  date: string
  meal_type:
    | "breakfast"
    | "lunch"
    | "dinner"
    | "snack"
    | "drink"
    | "unknown"
    | null
  food_name: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  portion_size: string | null
  restaurant: string | null
  notes: string | null
}

export type GymRow = {
  id: string
  date: string
  workout_class: string | null
  exercise: string
  sets: number | null
  reps: number | null
  weight: number | null
  unit: "lbs" | "kg" | "bodyweight" | "unknown" | null
  personal_record: boolean
  notes: string | null
}

export type JournalRow = {
  id: string
  date: string
  title: string | null
  entry: string
  mood:
    | "happy"
    | "motivated"
    | "stressed"
    | "tired"
    | "sad"
    | "angry"
    | "anxious"
    | "neutral"
    | "unknown"
    | null
  tags: string[] | null
}

export type JobStatus =
  | "wishlist"
  | "applied"
  | "interviewing"
  | "offer"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "ghosted"

export type JobApplicationRow = {
  id: string
  position_title: string
  company: string | null
  pay: string | null
  description: string | null
  url: string | null
  status: JobStatus
  applied_date: string
  notes: string | null
}

export type WeightRow = {
  id: string
  date: string
  weight: number | null
  unit: "lbs" | "kg" | "unknown" | null
  body_fat: number | null
  waist: number | null
  chest: number | null
  arms: number | null
  legs: number | null
  notes: string | null
}

export type SleepRow = {
  id: string
  date: string
  /** Tracker sleep score, 0-100. Null when only duration was logged. */
  score: number | null
  /** Hours actually asleep. 6.5 = six and a half. */
  hours: number | null
  bedtime: string | null
  wake_time: string | null
  notes: string | null
}
