"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, User } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

/**
 * Name row for Settings. Saved on the login's own profile (Supabase auth
 * metadata), which is where Today's "Good morning, …" reads it from.
 */
export function NameSetting({ initial }: { initial: string }) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const [saved, setSaved] = React.useState(initial)
  const [draft, setDraft] = React.useState(initial)
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = React.useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const value = draft.trim().replace(/\s+/g, " ")
    setError(null)
    setStatus("saving")
    // first_name too, since the greeting prefers it when it's there.
    const { error: err } = await supabase.auth.updateUser({
      data: { full_name: value || null, first_name: value ? value.split(" ")[0] : null },
    })
    if (err) {
      setStatus("idle")
      return setError(err.message)
    }
    setSaved(value)
    setDraft(value)
    setStatus("saved")
    router.refresh()
    window.setTimeout(() => setStatus("idle"), 1500)
  }

  const changed = draft.trim().replace(/\s+/g, " ") !== saved

  return (
    <form onSubmit={save} className="flex flex-col px-4 py-2">
      <label className="flex min-h-11 items-center gap-3 text-[15px] text-neutral-900 dark:text-neutral-100">
        <User className="size-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
        <span className="shrink-0">Name</span>
        <input
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setStatus("idle")
          }}
          placeholder="Your name"
          maxLength={60}
          className="min-w-0 flex-1 bg-transparent text-right text-base text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
        />
        {(changed || status !== "idle") && (
          <button
            type="submit"
            disabled={status === "saving"}
            className={cn(
              "flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 text-sm font-medium text-white",
              status === "saved" ? "bg-[#2FA36B]" : "bg-[#318E63]"
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
