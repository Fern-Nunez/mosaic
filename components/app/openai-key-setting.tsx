"use client"

import * as React from "react"
import { ChevronDown, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

type KeyState = { hasKey: boolean; hint: string | null }

/**
 * "OpenAI key" row for More → Settings. Meal photos and Insights run on
 * this key. Saved through /api/settings, which stores it encrypted; the
 * app only ever shows the last 4 characters back.
 */
export function OpenAIKeySetting() {
  const [state, setState] = React.useState<KeyState | null>(null)
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = React.useState(false)

  React.useEffect(() => {
    let live = true
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && j && setState({ hasKey: !!j.hasKey, hint: j.hint ?? null }))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  async function call(method: "POST" | "DELETE", body?: unknown) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/settings", {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Couldn't save. Try again.")
      setState({ hasKey: !!json.hasKey, hint: json.hint ?? null })
      setDraft("")
      setConfirmRemove(false)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setError(null)
          setConfirmRemove(false)
        }}
        aria-expanded={open}
        className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 text-left text-[15px] text-neutral-900 active:bg-neutral-100 dark:text-neutral-100 dark:active:bg-neutral-800"
      >
        <Sparkles className="size-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
        <span className="flex-1">OpenAI key</span>
        <span className="text-sm text-neutral-500 tabular-nums dark:text-neutral-400">
          {state === null ? "…" : state.hasKey ? `•••• ${state.hint ?? ""}` : "Not set"}
        </span>
        <ChevronDown className={cn("size-4 text-neutral-400 transition-transform dark:text-neutral-500", open && "rotate-180")} />
      </button>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return setError("Paste your key first.")
            call("POST", { apiKey: draft.trim() })
          }}
          className="flex flex-col gap-3 px-4 pb-4"
        >
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Meal photos and Insights run on this key, billed to your OpenAI account. It&apos;s stored encrypted and
            never shown again; only the last 4 characters are. Get one at{" "}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-[#318E63] underline">
              platform.openai.com/api-keys
            </a>
            .
          </p>
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={state?.hasKey ? "Paste a new key to replace it" : "sk-..."}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="OpenAI API key"
            className="h-12 rounded-xl bg-neutral-100 px-4 font-mono text-base text-neutral-900 outline-none placeholder:font-sans placeholder:text-neutral-400 dark:bg-neutral-800 dark:text-neutral-100"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="h-11 flex-1 cursor-pointer rounded-xl bg-[#318E63] text-[15px] font-medium text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : state?.hasKey ? "Replace key" : "Save key"}
            </button>
            {state?.hasKey && (
              <button
                type="button"
                disabled={busy}
                onClick={() => (confirmRemove ? call("DELETE") : setConfirmRemove(true))}
                className={cn(
                  "h-11 cursor-pointer rounded-xl px-4 text-[15px] font-medium disabled:opacity-50",
                  confirmRemove
                    ? "bg-red-600 text-white"
                    : "bg-neutral-100 text-red-600 dark:bg-neutral-800 dark:text-red-400"
                )}
              >
                {confirmRemove ? "Tap to confirm" : "Remove"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
