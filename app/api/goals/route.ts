import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

// Maps the JSON body fields to their user_settings columns.
const FIELDS = [
  ["calories", "calorie_goal"],
  ["protein", "protein_goal"],
  ["carbs", "carb_goal"],
  ["fat", "fat_goal"],
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

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, ...row }, { onConflict: "user_id" })

  if (error) {
    // Most likely the goal columns don't exist yet — point the user at the
    // migration instead of a raw PostgREST message.
    const message = /column|schema cache/i.test(error.message)
      ? "Nutrition goal columns are missing. Run the goals migration in Supabase, then try again."
      : error.message
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ goals })
}
