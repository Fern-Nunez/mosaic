"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = [0, 15, 30, 45]
const ROW = 40 // px per wheel row

/** "21:30" → { hour: 9, minute: 30, pm: true }. */
function split(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return { hour: h % 12 || 12, minute: m, pm: h >= 12 }
}
function join(hour: number, minute: number, pm: boolean) {
  const h = (hour % 12) + (pm ? 12 : 0)
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

/** "21:30" → "9:30 PM". */
export function timeLabel(hhmm: string) {
  const { hour, minute, pm } = split(hhmm)
  return `${hour}:${String(minute).padStart(2, "0")} ${pm ? "PM" : "AM"}`
}

/**
 * One scroll wheel: drag or flick, it snaps to a row, and the row in the
 * middle band is the pick. Spacers above and below let the first and last
 * items reach the middle. Tapping a row scrolls it to the middle.
 */
function Wheel({ items, index, onChange, label }: { items: string[]; index: number; onChange: (i: number) => void; label: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const settle = React.useRef<number | undefined>(undefined)

  // Start on the current value. Only on open; after that the wheel's own
  // scroll position is what picks.
  const start = React.useRef(index)
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = start.current * ROW
  }, [])

  function onScroll() {
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW)))
      if (i !== index) onChange(i)
    }, 90)
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      role="listbox"
      aria-label={label}
      className="relative h-[200px] snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: "linear-gradient(transparent, black 35%, black 65%, transparent)" }}
    >
      <div style={{ height: 80 }} />
      {items.map((item, i) => (
        <button
          key={item}
          type="button"
          role="option"
          aria-selected={i === index}
          onClick={() => ref.current?.scrollTo({ top: i * ROW, behavior: "smooth" })}
          className={cn(
            "flex h-10 w-full cursor-pointer snap-center items-center justify-center text-lg tabular-nums transition-colors",
            i === index ? "font-semibold text-neutral-900 dark:text-white" : "text-neutral-400 dark:text-neutral-500"
          )}
        >
          {item}
        </button>
      ))}
      <div style={{ height: 80 }} />
    </div>
  )
}

/**
 * Hour, minutes (15-minute steps) and AM/PM wheels side by side, with a
 * "Set for 9:30 PM" button under them. Opens under a settings row.
 */
export function TimeWheels({ initial, onDone }: { initial: string; onDone: (time: string) => void }) {
  const [draft, setDraft] = React.useState(initial)
  const d = split(draft)
  return (
    <div className="flex flex-col gap-2 pt-1 pb-2 pl-8">
      <div className="chip relative grid grid-cols-3 overflow-hidden rounded-2xl">
        {/* The band marking the picked row. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-1/2 h-10 -translate-y-1/2 rounded-xl border border-black/10 bg-white/70 dark:border-white/15 dark:bg-white/10"
        />
        <Wheel label="Hour" items={HOURS.map(String)} index={d.hour - 1} onChange={(i) => setDraft(join(i + 1, d.minute, d.pm))} />
        <Wheel
          label="Minutes"
          items={MINUTES.map((m) => `:${String(m).padStart(2, "0")}`)}
          index={Math.max(0, MINUTES.indexOf(d.minute))}
          onChange={(i) => setDraft(join(d.hour, MINUTES[i], d.pm))}
        />
        <Wheel label="AM or PM" items={["AM", "PM"]} index={d.pm ? 1 : 0} onChange={(i) => setDraft(join(d.hour, d.minute, i === 1))} />
      </div>
      <button
        type="button"
        onClick={() => onDone(draft)}
        className="chip h-10 cursor-pointer rounded-full text-sm font-medium text-neutral-900 transition-transform active:scale-[0.98] dark:text-neutral-100"
      >
        Set for {timeLabel(draft)}
      </button>
    </div>
  )
}
