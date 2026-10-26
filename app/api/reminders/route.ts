import { NextResponse, type NextRequest } from "next/server"

import { todayIn, workoutReminder } from "@/lib/push/reminders"
import { sendToSubscriptions, type SubscriptionRow } from "@/lib/push/send"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * The daily reminder. Vercel Cron calls this once a day (see vercel.json)
 * with `Authorization: Bearer $CRON_SECRET`.
 *
 * Testing on your computer: open
 *   http://localhost:3000/api/reminders?secret=YOUR_CRON_SECRET&dry=1
 * `dry=1` reports what it would send without sending. The `secret=` form
 * only works in development.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const url = request.nextUrl
  const viaHeader = request.headers.get("authorization") === `Bearer ${secret}`
  const viaQuery = process.env.NODE_ENV !== "production" && url.searchParams.get("secret") === secret
  if (!secret || !(viaHeader || viaQuery)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dry = url.searchParams.get("dry") === "1"
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth, timezone")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // One reminder per person, sent to each of their devices.
    const byUser = new Map<string, (SubscriptionRow & { timezone: string })[]>()
    for (const row of data ?? []) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row])

    const results = []
    for (const [userId, subs] of byUser) {
      const day = todayIn(subs[0].timezone)
      const reminder = await workoutReminder(admin, userId, day)
      if (!reminder.send || dry) {
        results.push({ userId, day, devices: subs.length, ...reminder, sent: 0 })
        continue
      }
      const sent = await sendToSubscriptions(admin, subs, reminder)
      results.push({ userId, day, devices: subs.length, ...reminder, ...sent })
    }
    return NextResponse.json({ dry, users: results.length, results })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 })
  }
}
