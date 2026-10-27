"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { CATEGORY_META } from "@/components/app/trends/meta"
import { usePrefs } from "@/components/app/prefs-context"
import { RangePicker } from "@/components/app/trends/range-picker"
import { HabitBars, MoneyPace, MoodDots, SupplementStrip, WeightMini, WorkoutStrip } from "@/components/app/trends/mini-charts"
import { SleepNights } from "@/components/app/trends/sleep-nights"
import { Sparkline } from "@/components/app/trends/sparkline"
import { useToday } from "@/components/app/use-today"
import { useHabits } from "@/components/dashboard/habits-context"
import type { Range } from "@/lib/app/dates"
import { makeWindow, summarize } from "@/lib/app/metrics"
import { DEFAULT_SLEEP_GOAL } from "@/lib/app/prefs"
import { TREND_CATEGORIES, type TrendCategory, type TrendData } from "@/lib/app/trend-data"
import type { Completion, Habit } from "@/lib/habits"

type MiniProps = { data: TrendData; today: string; color: string; habits: Habit[]; completions: Completion[] }

/** Which graphic each card shows on the right (Nutrition shows protein instead). */
const MINI: Partial<Record<TrendCategory, (p: MiniProps) => React.ReactNode>> = {
  sleep: ({ data, today }) => <SleepNights sleep={data.sleep} goal={data.prefs.sleepGoalHours ?? DEFAULT_SLEEP_GOAL} today={today} />,
  money: ({ data, today }) => <MoneyPace data={data} today={today} prefs={data.prefs} />,
  weight: ({ data, color }) => <WeightMini weights={data.recentWeights} goal={data.prefs.weightGoal ?? null} color={color} />,
  workout: ({ data, today, color }) => <WorkoutStrip data={data} today={today} color={color} />,
  journal: ({ data, today }) => <MoodDots data={data} today={today} />,
  habits: ({ habits, completions, today, color }) => <HabitBars habits={habits} completions={completions} today={today} color={color} />,
  supplements: ({ data, today, color }) => <SupplementStrip data={data} today={today} color={color} />,
}

export function TrendsOverview({ data, range }: { data: TrendData; range: Range }) {
  const today = useToday()
  const { habits, completions } = useHabits()
  const { prefs } = usePrefs()
  const categories = TREND_CATEGORIES.filter((c) => !prefs.hiddenSections?.includes(c))

  return (
    <div className="flex flex-col gap-4">
      <RangePicker active={range.id} />
      {today === null ? (
        <div className="min-h-[60svh]" aria-busy="true" />
      ) : (
        categories.map((category) => {
          const meta = CATEGORY_META[category]
          const s = summarize(category, data, makeWindow(today, range), { habits, completions })
          return (
            <Link
              key={category}
              href={`/app/trends/${category}?range=${range.id}`}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4 active:bg-neutral-50 dark:bg-neutral-900 dark:active:bg-neutral-800"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${meta.color}1F`, color: meta.color }}
                >
                  <meta.icon className="size-4" strokeWidth={2} />
                </span>
                <span className="flex-1 text-[15px] text-neutral-900 dark:text-neutral-100">{meta.label}</span>
                <ChevronRight className="size-4 text-neutral-400 dark:text-neutral-500" />
              </div>
              <div className="flex items-end gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-medium tracking-tight tabular-nums text-neutral-900 dark:text-neutral-100">
                    {s.value}
                  </p>
                  <p className="line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">{s.sub}</p>
                </div>
                {s.side ? (
                  // Nutrition: protein gets the same big number as calories.
                  <div className="mr-5 min-w-0 shrink-0 text-left">
                    <p className="text-2xl font-medium tracking-tight tabular-nums text-neutral-900 dark:text-neutral-100">
                      {s.side.value}
                    </p>
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{s.side.label}</p>
                  </div>
                ) : MINI[category] ? (
                  // A small "did I do it?" graphic answering one question per card.
                  <div className="w-32 shrink-0">{MINI[category]!({ data, today, color: meta.color, habits, completions })}</div>
                ) : (
                  <div className="w-28 shrink-0">
                    {!s.empty && (
                      <Sparkline
                        values={s.series}
                        color={meta.color}
                        // Daily columns on 30D are noisy; weight is already one point per weigh-in.
                        smoothing={range.id === "m" && category !== "weight" ? 7 : 1}
                      />
                    )}
                  </div>
                )}
              </div>
              {s.change && <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.change}</p>}
            </Link>
          )
        })
      )}
    </div>
  )
}
