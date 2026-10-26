import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import webpush from "web-push"

export type PushMessage = { title: string; body: string; url?: string; tag?: string }
export type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string }

let configured = false

/** Throws a readable error when the VAPID keys are missing. */
function configure() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) throw new Error("VAPID keys are missing. Add them to .env.local and restart the dev server.")
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", publicKey, privateKey)
  configured = true
}

/**
 * Sends to every given device. Devices the push service says are gone
 * (app deleted, permission revoked) are removed so they don't pile up.
 */
export async function sendToSubscriptions(supabase: SupabaseClient, subs: SubscriptionRow[], message: PushMessage) {
  configure()
  let sent = 0
  const errors: string[] = []
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(message),
          { TTL: 60 * 60 * 6 }
        )
        sent++
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id)
        } else {
          errors.push(error instanceof Error ? error.message : String(error))
        }
      }
    })
  )
  return { sent, errors }
}
