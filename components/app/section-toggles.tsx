"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { usePrefs } from "@/components/app/prefs-context"
import { CATEGORY_META } from "@/components/app/trends/meta"
import { Switch } from "@/components/ui/switch"
import type { SectionId } from "@/lib/app/prefs"
import { savePrefs } from "@/lib/app/save-prefs"
import { TREND_CATEGORIES } from "@/lib/app/trend-data"

/**
 * One switch per section. Off hides it from Today, Trends and the + menu.
 * Nothing is deleted; switching it back on brings everything back.
 */
export function SectionToggles() {
  const router = useRouter()
  const { prefs, ready, userId } = usePrefs()
  const [hidden, setHidden] = React.useState<SectionId[]>(prefs.hiddenSections ?? [])
  const [error, setError] = React.useState<string | null>(null)

  async function toggle(id: SectionId, on: boolean) {
    const prev = hidden
    const next = on ? hidden.filter((h) => h !== id) : [...hidden, id]
    // Keep at least one section, or Today and Trends would be empty.
    if (next.length >= TREND_CATEGORIES.length) return setError("Keep at least one section on.")
    setError(null)
    setHidden(next)
    const err = await savePrefs(userId, { hiddenSections: next })
    if (err) {
      setHidden(prev)
      setError(err)
      return
    }
    router.refresh()
  }

  return (
    <>
      {!ready && (
        <p className="px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Run the settings SQL in Supabase before these will save.
        </p>
      )}
      {TREND_CATEGORIES.map((id) => {
        const meta = CATEGORY_META[id]
        const on = !hidden.includes(id)
        return (
          <label key={id} className="flex min-h-12 cursor-pointer items-center gap-3 px-4">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${meta.color}1F`, color: meta.color }}
            >
              <meta.icon className="size-3.5" strokeWidth={2} />
            </span>
            <span className={`flex-1 text-[15px] ${on ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-500"}`}>
              {meta.label}
            </span>
            <Switch checked={on} onCheckedChange={(v) => toggle(id, v)} className="data-checked:bg-[#318E63]" />
          </label>
        )
      })}
      {error && <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </>
  )
}
