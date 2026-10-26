"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { RANGES, type RangeId } from "@/lib/app/dates"
import { cn } from "@/lib/utils"

/**
 * "Time Range" row from the Figma: label on the left, D · M · Q · Y on the
 * right, a rule underneath. Kept in the URL so it survives back/forward.
 */
export function RangePicker({ active }: { active: RangeId }) {
  const pathname = usePathname()
  // The pill moves on tap, not when the server finishes the new page.
  // Cleared automatically once `active` catches up.
  const [pending, setPending] = React.useState<{ id: RangeId; from: RangeId } | null>(null)
  const shown = pending && pending.from === active ? pending.id : active
  const index = Math.max(0, RANGES.findIndex((r) => r.id === shown))

  return (
    <div className="flex items-center justify-between border-b border-neutral-800 pb-3 dark:border-neutral-400">
      <span className="text-base text-neutral-500 dark:text-neutral-400">Time Range</span>
      {/* Figma: gray track, white pill on the active one, gray text on all. */}
      <div className="relative flex rounded-lg bg-[#DEDEDE] p-[3px] dark:bg-neutral-800">
        <span
          aria-hidden
          className="absolute top-[3px] left-[3px] h-7 w-9 rounded-md bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.15)] motion-reduce:transition-none dark:bg-neutral-600"
          style={{ transform: `translateX(${index * 36}px)` }}
        />
        {RANGES.map((r) => (
          <Link
            key={r.id}
            href={`${pathname}?range=${r.id}`}
            replace
            scroll={false}
            onClick={() => r.id !== shown && setPending({ id: r.id, from: active })}
            aria-current={r.id === active ? "true" : undefined}
            className={cn(
              "relative flex h-7 w-9 items-center justify-center rounded-md text-sm transition-colors duration-200",
              r.id === shown ? "text-neutral-900 dark:text-neutral-100" : "text-[#6B6B6B] dark:text-neutral-400"
            )}
          >
            {r.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
