"use client"

import * as React from "react"
import { Check, Phone } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

/** 10 US digits → +1XXXXXXXXXX; anything else with a + is kept as typed digits. */
function normalize(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const digits = trimmed.replace(/\D/g, "")
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return null
}

/** "+19095551234" → "(909) 555-1234" for US numbers. */
function pretty(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

/**
 * Phone number row for Settings. Saved on user_settings.phone_number in
 * +1XXXXXXXXXX form, ready for texting features later.
 */
export function PhoneSetting({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), [])
  const [saved, setSaved] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState("")
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    // "*" so this still loads before the phone_number column exists.
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const value = (data?.phone_number as string | null | undefined) ?? ""
        setSaved(value)
        setDraft(value ? pretty(value) : "")
      })
    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const value = normalize(draft)
    if (value === null) return setError("Enter a 10-digit number, or include a + and country code.")
    setError(null)
    setStatus("saving")
    const { error: err } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, phone_number: value || null }, { onConflict: "user_id" })
    if (err) {
      setStatus("idle")
      return setError(
        /phone_number|schema cache|column/i.test(err.message)
          ? "Run the phone number SQL in Supabase, then try again."
          : err.message
      )
    }
    setSaved(value)
    setDraft(value ? pretty(value) : "")
    setStatus("saved")
    window.setTimeout(() => setStatus("idle"), 1500)
  }

  const changed = saved !== null && normalize(draft) !== saved

  return (
    <form onSubmit={save} className="flex flex-col px-4 py-2">
      <label className="flex min-h-11 items-center gap-3 text-[15px] text-neutral-900 dark:text-neutral-100">
        <Phone className="size-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
        <span className="shrink-0">Phone</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setStatus("idle")
          }}
          placeholder={saved === null ? "Loading…" : "(909) 555-1234"}
          disabled={saved === null}
          className="min-w-0 flex-1 bg-transparent text-right text-base text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
        />
        {(changed || status !== "idle") && (
          <button
            type="submit"
            disabled={status === "saving"}
            className={cn(
              "flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 text-sm font-medium text-white",
              status === "saved" ? "bg-[#4E8A6B]" : "bg-[#318E63]"
            )}
          >
            {status === "saved" ? <Check className="size-4" /> : status === "saving" ? "…" : "Save"}
          </button>
        )}
      </label>
      {error && <p className="pb-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  )
}
