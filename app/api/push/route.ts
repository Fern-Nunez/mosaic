import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

/** Save this device so it can get reminders. Body: { subscription, timezone }. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const sub = body?.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "Missing subscription" }, { status: 400 })
  }
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      timezone: typeof body.timezone === "string" ? body.timezone : "America/Los_Angeles",
    },
    { onConflict: "endpoint" }
  )
  if (error) {
    const missing = /push_subscriptions|schema cache/i.test(error.message)
    return NextResponse.json(
      { error: missing ? "Run the push_subscriptions SQL in Supabase first." : error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}

/** Forget this device. Body: { endpoint }. */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })
  await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint)
  return NextResponse.json({ ok: true })
}
