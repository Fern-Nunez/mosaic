"use client"

import * as React from "react"
import { Bell } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { dateKey } from "@/lib/app/dates"

type Status =
  | "loading"
  | "install" // iPhone, not opened from the home screen yet
  | "unsupported"
  | "no-key" // VAPID keys not in .env.local
  | "blocked" // permission denied in settings
  | "off"
  | "on"

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function toBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function detect(): Promise<{ status: Status; sub: PushSubscription | null }> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  if (!supported) {
    const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    return { status: iPhone && !standalone ? "install" : "unsupported", sub: null }
  }
  if (!PUBLIC_KEY) return { status: "no-key", sub: null }
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
  const sub = await registration.pushManager.getSubscription()
  if (Notification.permission === "denied") return { status: "blocked", sub: null }
  return { status: sub ? "on" : "off", sub }
}

async function post(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
  return json
}

/** More → Notifications: turn reminders on for this device and test them. */
export function NotificationSetting({ rowClassName }: { rowClassName: string }) {
  const [status, setStatus] = React.useState<Status>("loading")
  const [sub, setSub] = React.useState<PushSubscription | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [canSendNow, setCanSendNow] = React.useState(false)

  React.useEffect(() => {
    let live = true
    detect()
      .then((r) => {
        if (!live) return
        setStatus(r.status)
        setSub(r.sub)
      })
      .catch(() => live && setStatus("unsupported"))
    return () => {
      live = false
    }
  }, [])

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setMessage(null)
    try {
      await task()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  const turnOn = () =>
    run(async () => {
      // Must come straight from the tap, or iPhones refuse to ask.
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const next = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toBytes(PUBLIC_KEY!),
      })
      await post("/api/push", "POST", {
        subscription: next.toJSON(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      setSub(next)
      setStatus("on")
      setMessage("On. Tap Send test to make sure it arrives.")
    })

  const turnOff = () =>
    run(async () => {
      if (sub) {
        await post("/api/push", "DELETE", { endpoint: sub.endpoint }).catch(() => {})
        await sub.unsubscribe()
      }
      setSub(null)
      setStatus("off")
      setCanSendNow(false)
    })

  const sendTest = () =>
    run(async () => {
      const r = await post("/api/push/test", "POST", { mode: "test" })
      setMessage(r.sent ? "Sent. It should show up in a few seconds." : `Nothing sent. ${r.errors?.[0] ?? ""}`)
    })

  const check = () =>
    run(async () => {
      const r = await post("/api/push/test", "POST", { mode: "check", today: dateKey(new Date()) })
      setCanSendNow(r.reminder.send)
      setMessage(r.reminder.send ? `Tonight it would send: "${r.reminder.title}"` : `No reminder tonight. ${r.reminder.reason}`)
    })

  const sendNow = () =>
    run(async () => {
      const r = await post("/api/push/test", "POST", { mode: "send", today: dateKey(new Date()) })
      setMessage(r.sent ? "Reminder sent." : r.reminder?.reason ?? "Nothing sent.")
      setCanSendNow(false)
    })

  const note: Partial<Record<Status, string>> = {
    install: "On iPhone, open Mosaic in Safari, tap Share → Add to Home Screen, then open it from that icon to turn these on.",
    unsupported: "This browser can't show notifications.",
    "no-key": "Add the VAPID keys to .env.local and restart the dev server.",
    blocked: "Notifications are blocked for Mosaic. Allow them in your phone or browser settings, then come back.",
  }

  const base = "h-9 cursor-pointer rounded-full px-4 text-sm disabled:opacity-50"
  const button = `${base} bg-neutral-100 text-neutral-800 active:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:active:bg-neutral-700`
  const primary = `${base} bg-[#318E63] text-white active:bg-[#2A7A55]`

  return (
    <div>
      <label className={`${rowClassName} py-2.5 ${status === "on" || status === "off" ? "cursor-pointer" : ""}`}>
        <Bell className="size-5 text-neutral-500 dark:text-neutral-400" />
        <span className="flex-1">
          Workout reminders
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">Evening nudge if your workout isn&apos;t logged</span>
        </span>
        <Switch
          checked={status === "on"}
          disabled={busy || (status !== "on" && status !== "off")}
          onCheckedChange={(on) => (on ? turnOn() : turnOff())}
          className="data-checked:bg-[#318E63]"
        />
      </label>
      {(note[status] || status === "on" || message) && (
        <div className="flex flex-col gap-3 pr-4 pb-4 pl-12">
          {note[status] && <p className="text-sm text-neutral-500 dark:text-neutral-400">{note[status]}</p>}
          {status === "on" && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={sendTest} className={button}>Send test</button>
              <button type="button" disabled={busy} onClick={check} className={button}>Check today</button>
              {canSendNow && (
                <button type="button" disabled={busy} onClick={sendNow} className={primary}>
                  Send it now
                </button>
              )}
            </div>
          )}
          {message && <p className="text-sm text-neutral-700 dark:text-neutral-300" role="status">{message}</p>}
        </div>
      )}
    </div>
  )
}
