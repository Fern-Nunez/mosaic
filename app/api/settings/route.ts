import { NextResponse } from "next/server"

import { encryptSecret } from "@/lib/crypto"
import { createClient } from "@/lib/supabase/server"

// Loose shape check so obvious paste mistakes fail fast. OpenAI keys
// start with "sk-" (project keys with "sk-proj-").
const KEY_PATTERN = /^sk-[A-Za-z0-9_-]{20,}$/

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  const { supabase, user } = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("key_hint, openai_api_key")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    hasKey: Boolean(data?.openai_api_key),
    hint: data?.key_hint ?? null,
  })
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : ""

  if (!KEY_PATTERN.test(apiKey)) {
    return NextResponse.json(
      { error: "That doesn't look like an OpenAI API key (should start with sk-)." },
      { status: 400 }
    )
  }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      openai_api_key: encryptSecret(apiKey),
      key_hint: apiKey.slice(-4),
    },
    { onConflict: "user_id" }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ hasKey: true, hint: apiKey.slice(-4) })
}

export async function DELETE() {
  const { supabase, user } = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  const { error } = await supabase
    .from("user_settings")
    .update({ openai_api_key: null, key_hint: null })
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ hasKey: false, hint: null })
}
