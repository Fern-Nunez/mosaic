"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { RANGES, type RangeId } from "@/lib/app/dates"
import { cn } from "@/lib/utils"

/**
 * "Time Range" row from the Figma: label on the left, 30D · 90D · 1Y on the
 * right, a rule underneath. Kept in the URL so it survives back/forward.
 */
export function RangePicker({ active }: { active: RangeId }) {
  const pathname = usePathname()
  return (
    <div className="flex items-center justify-between border-b border-neutral-800 pb-3 dark:border-neutral-400">
      <span className="text-base text-neutral-500 dark:text-neutral-400">Time Range</span>
      {/* Figma: gray track, white pill on the active one, gray text on all. */}
      <div className="flex rounded-lg bg-[#DEDEDE] p-[3px] dark:bg-neutral-800">
        {RANGES.map((r) => (
          <Link
            key={r.id}
            href={`${pathname}?range=${r.id}`}
            replace
            scroll={false}
            aria-current={r.id === active ? "true" : undefined}
            className={cn(
              "flex h-7 min-w-9 items-center justify-center rounded-md px-2 text-sm text-[#6B6B6B] transition-colors dark:text-neutral-400",
              r.id === active && "bg-white shadow-sm dark:bg-neutral-600 dark:text-neutral-100"
            )}
          >
            {r.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
