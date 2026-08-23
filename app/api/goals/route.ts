import { NextResponse } from "next/server"

import {
  DEFAULT_ESTIMATE_LEVEL,
  ESTIMATE_LEVELS,
  type EstimateLevel,
} from "@/lib/stats"
import { createClient } from "@/lib/supabase/server"

// Maps the JSON body fields to their user_settings columns.
const FIELDS = [
  ["calories", "calorie_goal"],
  ["protein", "protein_goal"],
  ["carbs", "carb_goal"],
  ["fat", "fat_goal"],
  ["fiber", "fiber_goal"],
] as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)

  const row: Record<string, number> = {}
  const goals: Record<string, number> = {}
  for (const [key, column] of FIELDS) {
    const raw = Number(body?.[key])
    if (!Number.isFinite(raw) || raw <= 0 || raw > 100000) {
      return NextResponse.json(
        { error: `Enter a ${key} goal between 1 and 100,000.` },
        { status: 400 }
      )
    }
    const value = Math.round(raw)
    row[column] = value
    goals[key] = value
  }

  // The estimate bias the meal analyzer uses. Lives with the goals so it's
  // chosen once here rather than on every photo.
  const rawLevel = String(body?.estimateLevel ?? DEFAULT_ESTIMATE_LEVEL)
  if (!ESTIMATE_LEVELS.includes(rawLevel as EstimateLevel)) {
    return NextResponse.json(
      { error: "Estimate level must be low, middle, or high." },
      { status: 400 }
    )
  }
  const estimateLevel = rawLevel as EstimateLevel

  const { error } = await supabase.from("user_settings").upsert(
    { user_id: user.id, ...row, estimate_level: estimateLevel },
    { onConflict: "user_id" }
  )

  if (error) {
    // Most likely the goal columns don't exist yet — point the user at the
    // migration instead of a raw PostgREST message.
    const message = /column|schema cache/i.test(error.message)
      ? "Nutrition goal columns are missing. Run the goals migration in Supabase, then try again."
      : error.message
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ goals, estimateLevel })
}
