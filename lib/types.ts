export type MoneyRow = {
  id: string
  date: string
  amount: number
  category:
    | "Transportation"
    | "Food"
    | "Medical"
    | "Entertainment"
    | "Personal"
    | "Gifts"
    | "Bills"
    | "Income"
    | "Other"
    | null
  transaction_type: "income" | "expense" | null
  description: string | null
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
  portion_size: string | null
  restaurant: string | null
  notes: string | null
}

export type GymRow = {
  id: string
  date: string
  workout_name: string | null
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
