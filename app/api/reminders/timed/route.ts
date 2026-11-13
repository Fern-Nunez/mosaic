import { NextResponse, type NextRequest } from "next/server"

import { journalReminder, minutesIn, supplementReminder, todayIn, weightReminder, workoutReminder } from "@/lib/push/reminders"
import { sendToSubscriptions, type SubscriptionRow } from "@/lib/push/send"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Reminders at the time each person picked (workout, journal, supplements,
 * weight). Call this
 * every 15 minutes with `Authorization: Bearer $CRON_SECRET` (a free pinger
 * like cron-job.org); each reminder goes out in the run whose 15-minute
 * slot holds its time, in that person's own time zone.
 *
 * Testing on your computer:
 *   http://localhost:3000/api/reminders/timed?secret=YOUR_CRON_SECRET&dry=1
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

    // Each person's devices together; their first device's time zone decides "now".
    const byUser = new Map<string, (SubscriptionRow & { timezone: string })[]>()
    for (const row of data ?? []) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row])

    const results = []
    for (const [userId, subs] of byUser) {
      const tz = subs[0].timezone
      const day = todayIn(tz)
      const minutes = minutesIn(tz)
      const [workout, journal, supplements, weight] = await Promise.all([
        workoutReminder(admin, userId, day, minutes),
        journalReminder(admin, userId, day, minutes),
        supplementReminder(admin, userId, day, minutes),
        weightReminder(admin, userId, day, minutes),
      ])
      const all = [["workout", workout], ["journal", journal], ["supplements", supplements], ["weight", weight]] as const
      for (const [kind, reminder] of all) {
        if (!reminder.send || dry) {
          results.push({ userId, kind, day, devices: subs.length, ...reminder, sent: 0 })
          continue
        }
        const sent = await sendToSubscriptions(admin, subs, reminder)
        results.push({ userId, kind, day, devices: subs.length, ...reminder, ...sent })
      }
    }
    return NextResponse.json({ dry, users: byUser.size, results })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 })
  }
}
