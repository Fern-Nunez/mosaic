import { NextResponse, type NextRequest } from "next/server"

import { workoutReminder } from "@/lib/push/reminders"
import { sendToSubscriptions, type SubscriptionRow } from "@/lib/push/send"
import { createClient } from "@/lib/supabase/server"

/**
 * Buttons in More → Notifications, for the signed-in user only.
 * Body: { mode: "test" | "check" | "send", today: "YYYY-MM-DD" }
 *  - test:  send a plain "it works" notification
 *  - check: say what tonight's reminder would do, without sending
 *  - send:  run the real reminder now
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const mode = body?.mode
  const today = typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null
  if (!["test", "check", "send"].includes(mode)) return NextResponse.json({ error: "Unknown mode" }, { status: 400 })

  try {
    if (mode === "check" || mode === "send") {
      if (!today) return NextResponse.json({ error: "Missing date" }, { status: 400 })
      const reminder = await workoutReminder(supabase, user.id, today)
      if (mode === "check" || !reminder.send) return NextResponse.json({ reminder, sent: 0 })
      const subs = await mySubscriptions(supabase, user.id)
      const result = await sendToSubscriptions(supabase, subs, reminder)
      return NextResponse.json({ reminder, ...result })
    }

    const subs = await mySubscriptions(supabase, user.id)
    if (!subs.length) return NextResponse.json({ error: "No devices are signed up yet. Turn notifications on first." }, { status: 400 })
    const result = await sendToSubscriptions(supabase, subs, {
      title: "Notifications are on",
      body: "This is what a Mosaic reminder looks like.",
      url: "/app/more",
      tag: "test",
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 })
  }
}

async function mySubscriptions(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId)
  return (data ?? []) as SubscriptionRow[]
}
