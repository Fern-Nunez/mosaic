"use client"

import * as React from "react"
import { KeyRound, Settings } from "lucide-react"

import { CalendarManager } from "@/components/dashboard/calendar-manager"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { SidebarMenuButton } from "@/components/ui/sidebar"

export function SettingsDialog() {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [hasKey, setHasKey] = React.useState(false)
  const [hint, setHint] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch("/api/settings")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        setHasKey(Boolean(json.hasKey))
        setHint(json.hint ?? null)
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load settings.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  async function saveKey(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: draft }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Couldn't save the key.")
      setHasKey(true)
      setHint(json.hint ?? null)
      setDraft("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the key.")
    } finally {
      setBusy(false)
    }
  }

  async function removeKey() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/settings", { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Couldn't remove the key.")
      setHasKey(false)
      setHint(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the key.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <SidebarMenuButton tooltip="Settings">
            <Settings />
            <span>Settings</span>
          </SidebarMenuButton>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Your OpenAI API key powers meal photo analysis and is billed to
            your OpenAI account.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form onSubmit={saveKey} className="space-y-4">
            {hasKey && (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3 text-sm">
                <span className="flex items-center gap-2">
                  <KeyRound className="size-4 text-muted-foreground" />
                  Key saved{hint ? ` · ends in ${hint}` : ""}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="xs"
                  onClick={removeKey}
                  disabled={busy}
                >
                  Remove
                </Button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="openai-key">
                {hasKey ? "Replace key" : "OpenAI API key"}
              </Label>
              <Input
                id="openai-key"
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="sk-…"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Stored encrypted and only used on the server — it never
                appears in the browser again. Create one at
                platform.openai.com/api-keys.
              </p>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={busy || !draft.trim()}>
                {busy ? "Saving…" : "Save key"}
              </Button>
            </div>
          </form>
        )}

        <Separator />

        <CalendarManager />
      </DialogContent>
    </Dialog>
  )
}
