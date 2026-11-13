"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Check, ChevronDown } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RANGES, type RangeId } from "@/lib/app/dates"
import { cn } from "@/lib/utils"

/**
 * "Time Range" row: label on the left, a see-through pill dropdown on the right
 * (Today / This month / This quarter / This year). Kept in the URL so it
 * survives back/forward.
 */
export function RangePicker({ active, keep }: { active: RangeId; keep?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  // The label changes on tap, not when the server finishes the new page.
  // Cleared automatically once `active` catches up.
  const [pending, setPending] = React.useState<{ id: RangeId; from: RangeId } | null>(null)
  const shown = pending && pending.from === active ? pending.id : active
  const current = RANGES.find((r) => r.id === shown) ?? RANGES[1]

  function pick(id: RangeId) {
    if (id === shown) return
    setPending({ id, from: active })
    router.replace(`${pathname}?range=${id}${keep ? `&${keep}` : ""}`, { scroll: false })
  }

  return (
    <div className="flex items-center justify-between border-b border-neutral-800 pb-3 dark:border-neutral-400">
      <span className="text-base text-neutral-500 dark:text-neutral-400">Time Range</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="chip flex h-8 cursor-pointer items-center gap-1.5 rounded-full pr-2.5 pl-3.5 text-sm font-medium text-neutral-900 transition-transform active:scale-95 dark:text-neutral-100"
            >
              {current.title}
              <ChevronDown className="size-4 opacity-80" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-44 rounded-xl p-1">
          {RANGES.map((r) => (
            <DropdownMenuItem
              key={r.id}
              onClick={() => pick(r.id)}
              className={cn("h-10 rounded-lg px-3 text-[15px]", r.id === shown && "font-medium")}
            >
              {r.title}
              {r.id === shown && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
