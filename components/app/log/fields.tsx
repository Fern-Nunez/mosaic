"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/* Form pieces for the + loggers. 16px text everywhere so iOS doesn't zoom. */

const inputClass =
  "h-12 w-full min-w-0 appearance-none rounded-xl bg-neutral-100 px-4 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#318E63]/50 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-sm text-neutral-500 dark:text-neutral-400">
        {label}
        {hint && <span className="text-xs">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

/**
 * Like Field, but for a set of buttons (chips). A <label> would attach
 * itself to the first chip, so tapping the label text would select it.
 */
export function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const id = React.useId()
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1.5">
      <span id={id} className="text-sm text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      {children}
    </div>
  )
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <input {...props} className={cn(inputClass, props.className)} />
}

export function NumberInput(props: React.ComponentProps<"input">) {
  return <TextInput inputMode="decimal" type="text" autoComplete="off" {...props} />
}

export function TextArea(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn(inputClass, "h-auto min-h-32 resize-none py-3 leading-relaxed", props.className)}
    />
  )
}

/** Pick one of a few options. */
export function Choice<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "h-10 cursor-pointer rounded-full px-4 text-sm transition-colors",
            value === o.value
              ? "bg-[#318E63] text-white"
              : "bg-neutral-100 text-neutral-700 active:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:active:bg-neutral-700"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Full-width segmented toggle (e.g. Expense / Income). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      className="grid rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "h-10 cursor-pointer rounded-lg text-sm transition-colors",
            value === o.value
              ? "bg-white font-medium text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
              : "text-neutral-500 dark:text-neutral-400"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Tappable "recent" suggestions above a form. */
export function Recents({
  items,
  onPick,
}: {
  items: { key: string; label: string }[]
  onPick: (key: string) => void
}) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-neutral-500 dark:text-neutral-400">Recent</span>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {items.map((i) => (
          <button
            key={i.key}
            type="button"
            onClick={() => onPick(i.key)}
            className="h-9 shrink-0 cursor-pointer rounded-full border border-neutral-200 px-3 text-sm whitespace-nowrap text-neutral-700 active:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:active:bg-neutral-800"
          >
            {i.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SaveButton({
  busy,
  disabled,
  children = "Save",
}: {
  busy: boolean
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="mt-2 h-12 w-full cursor-pointer rounded-xl bg-[#318E63] text-base font-medium text-white transition-opacity active:opacity-90 disabled:cursor-default disabled:opacity-40"
    >
      {busy ? "Saving…" : children}
    </button>
  )
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
      {children}
    </p>
  )
}

/** "12.5" → 12.5, "" or junk → null. */
export function toNumber(value: string): number | null {
  const n = Number(value.replace(/,/g, "").trim())
  return value.trim() === "" || !Number.isFinite(n) ? null : n
}
